import { FastifyInstance } from 'fastify'
import {
  createOrder,
  addOrderItem,
  addOrderItemVariations,
  updateOrderItemStatus,
  getOrder,
  getOrderItems,
  getQueueByZone,
  getMenuItem,
  getTable,
  listTables,
  closeOrder,
  listOpenOrders,
  setOrderTabNumber,
  getVariationDeltaSum,
  getActivePromotionForItem,
  getComboBundleById,
  routePendingItems,
  cancelOrder,
} from '../db/queries'
import {
  CreateOrderRequest,
  AddOrderItemRequest,
  UpdateItemStatusRequest,
  CloseOrderRequest,
  SetTabNumberRequest,
  AddComboToOrderRequest,
  ItemStatus,
  Priority,
  RoutingZone,
} from '@vynex/shared'
import {
  broadcastItemAdded,
  broadcastItemStatusChanged,
  broadcastQueueSnapshot,
  broadcastOrderClosed,
  broadcastAllQueueSnapshots,
} from '../ws/broadcast'

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tables', async () => {
    return listTables()
  })

  app.get('/orders/open', async () => {
    return listOpenOrders()
  })

  app.post<{ Body: CreateOrderRequest }>('/orders', async (request, reply) => {
    const { table_id, routing_mode } = request.body

    const table = await getTable(table_id)
    if (!table) {
      return reply.status(404).send({ error: 'Table not found' })
    }

    const order = await createOrder(table_id, routing_mode ?? 'auto')
    return reply.status(201).send(order)
  })

  app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    const { id } = request.params
    const order = await getOrder(id)

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    const items = await getOrderItems(id)
    return reply.send({ ...order, items })
  })

  app.post<{ Params: { id: string }; Body: CloseOrderRequest }>(
    '/orders/:id/close',
    async (request, reply) => {
      const { id } = request.params
      const { payment_method } = request.body

      const order = await getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }
      if (order.status === 'closed') {
        return reply.status(400).send({ error: 'Order is already closed' })
      }
      if (!payment_method || !['cash', 'card'].includes(payment_method)) {
        return reply.status(400).send({ error: 'payment_method must be cash or card' })
      }

      const closed = await closeOrder(id, payment_method)

      broadcastOrderClosed(id, order.table_id)
      broadcastAllQueueSnapshots()

      return reply.send(closed)
    }
  )

  app.post<{ Params: { id: string }; Body: AddOrderItemRequest }>(
    '/orders/:id/items',
    async (request, reply) => {
      const { id } = request.params
      const { menu_item_id, quantity, notes, priority, variations } = request.body

      const order = await getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      const menuItem = await getMenuItem(menu_item_id)
      if (!menuItem) {
        return reply.status(404).send({ error: 'Menu item not found' })
      }

      const validPriorities = Object.values(Priority)
      const resolvedPriority =
        priority && validPriorities.includes(priority) ? priority : Priority.NORMAL

      // Compute base price including variation deltas
      const variationDelta = variations && variations.length > 0
        ? await getVariationDeltaSum(variations)
        : 0
      const basePrice = menuItem.price + variationDelta

      // Resolve best active promotion
      const { finalPrice, discountAmount, promotion } = await getActivePromotionForItem(
        menuItem.id, menuItem.category_id, basePrice
      )

      const item = await addOrderItem(
        id, menu_item_id, quantity, notes, undefined, resolvedPriority,
        finalPrice, discountAmount, promotion?.id ?? null, null
      )

      if (variations && variations.length > 0) {
        await addOrderItemVariations(item.id, variations)
      }

      return reply.status(201).send(item)
    }
  )

  app.post<{ Params: { id: string }; Body: AddComboToOrderRequest }>(
    '/orders/:id/combos',
    async (request, reply) => {
      const { id } = request.params
      const { combo_id } = request.body

      const order = await getOrder(id)
      if (!order) return reply.status(404).send({ error: 'Order not found' })
      if (order.status === 'closed') return reply.status(400).send({ error: 'Order is already closed' })

      const combo = await getComboBundleById(combo_id)
      if (!combo) return reply.status(404).send({ error: 'Combo not found' })
      if (!combo.enabled) return reply.status(400).send({ error: 'Combo is not available' })
      if (combo.items.length === 0) return reply.status(422).send({ error: 'Combo has no items' })

      // Check all component items still exist
      for (const ci of combo.items) {
        const mi = await getMenuItem(ci.menu_item_id)
        if (!mi) return reply.status(422).send({ error: `Menu item ${ci.menu_item_id} no longer exists` })
      }

      // Compute total individual price for proportional distribution
      const totalIndividualPrice = combo.items.reduce(
        (sum, ci) => sum + ci.menu_item.price * ci.quantity,
        0
      )

      const { v4: uuidV4 } = require('uuid')
      const comboGroupId = uuidV4()
      const createdItems = []

      for (const ci of combo.items) {
        const individualTotal = ci.menu_item.price * ci.quantity
        const proportionalFinalPrice = totalIndividualPrice > 0
          ? Math.round((ci.menu_item.price * (combo.bundle_price / totalIndividualPrice)) * 100) / 100
          : ci.menu_item.price
        const discountPerUnit = Math.round((ci.menu_item.price - proportionalFinalPrice) * 100) / 100

        const item = await addOrderItem(
          id, ci.menu_item_id, ci.quantity,
          undefined, undefined, Priority.NORMAL,
          proportionalFinalPrice, discountPerUnit, null, comboGroupId
        )
        createdItems.push(item)

        void individualTotal // suppress unused warning
      }

      return reply.status(201).send({ combo_group_id: comboGroupId, items: createdItems })
    }
  )

  app.patch<{ Params: { id: string; itemId: string }; Body: UpdateItemStatusRequest }>(
    '/orders/:id/items/:itemId',
    async (request, reply) => {
      const { id, itemId } = request.params
      const { status } = request.body

      const order = await getOrder(id)
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      const validStatuses = Object.values(ItemStatus)
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ error: 'Invalid status' })
      }

      const items = await getOrderItems(id)
      const currentItem = items.find(item => item.id === itemId)
      const oldStatus = currentItem?.status

      const item = await updateOrderItemStatus(itemId, status)

      if (oldStatus && currentItem) {
        broadcastItemStatusChanged(itemId, oldStatus, status, currentItem.menu_item.routing_zone)
        broadcastQueueSnapshot(currentItem.menu_item.routing_zone)
      }

      return reply.send(item)
    }
  )

  app.patch<{ Params: { id: string }; Body: SetTabNumberRequest }>(
    '/orders/:id/tab-number',
    async (request, reply) => {
      const { id } = request.params
      const { tab_number } = request.body

      const order = await getOrder(id)
      if (!order) return reply.status(404).send({ error: 'Order not found' })
      if (order.status === 'closed') return reply.status(400).send({ error: 'Order is already closed' })

      await setOrderTabNumber(id, tab_number)
      return reply.send({ id, tab_number })
    }
  )

  app.get<{ Params: { routingZone: string } }>('/queues/:routingZone', async (request, reply) => {
    const { routingZone } = request.params

    const validZones = Object.values(RoutingZone)
    if (!validZones.includes(routingZone as RoutingZone)) {
      return reply.status(400).send({ error: 'Invalid routing zone' })
    }

    const queue = await getQueueByZone(routingZone as RoutingZone)
    return reply.send(queue)
  })

  app.post<{ Params: { id: string } }>('/orders/:id/confirm-routing', async (request, reply) => {
    const { id } = request.params
    const order = await getOrder(id)
    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (order.status === 'closed') return reply.status(400).send({ error: 'Order is already closed' })

    const { routed_count, zones, items } = await routePendingItems(id)

    for (const item of items) {
      broadcastItemAdded(item.id, item.menu_item_name, item.routing_zone, item.table_name, item.quantity)
    }
    for (const zone of zones) {
      broadcastQueueSnapshot(zone)
    }

    return reply.send({ routed_count, zones })
  })

  app.patch<{ Params: { id: string } }>('/orders/:id/cancel', async (request, reply) => {
    const { id } = request.params
    const order = await getOrder(id)
    if (!order) return reply.status(404).send({ error: 'Order not found' })
    if (order.status === 'closed') return reply.status(400).send({ error: 'Order is already closed' })

    const cancelled = await cancelOrder(id)
    broadcastOrderClosed(id, order.table_id)
    broadcastAllQueueSnapshots()
    return reply.send(cancelled)
  })
}
