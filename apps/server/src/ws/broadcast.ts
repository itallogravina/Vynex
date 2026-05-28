import {
  WebSocketEvent,
  ItemAddedEvent,
  ItemStatusChangedEvent,
  QueueSnapshotEvent,
  RoutingZone,
  ItemStatus,
} from '@vynex/shared'
import { getQueueByZone } from '../db/queries'

type WebSocketLike = {
  send(data: string | Buffer, callback?: (error?: Error) => void): void
  close(): void
  readyState: number
}

type SubscribedClient = {
  socket: WebSocketLike
  routing_zones: Set<RoutingZone>
}

const connectedClients: SubscribedClient[] = []

export function addClient(socket: WebSocketLike, routing_zones: RoutingZone[]): void {
  const client: SubscribedClient = {
    socket,
    routing_zones: new Set(routing_zones),
  }
  connectedClients.push(client)

  // Send initial queue snapshot for each zone
  routing_zones.forEach(zone => {
    const queue = getQueueByZone(zone)
    const event: QueueSnapshotEvent = {
      type: 'queue:snapshot',
      routing_zone: zone,
      items: queue,
    }
    socket.send(JSON.stringify(event))
  })
}

export function removeClient(socket: WebSocketLike): void {
  const index = connectedClients.findIndex(c => c.socket === socket)
  if (index >= 0) {
    connectedClients.splice(index, 1)
  }
}

export function broadcastItemAdded(
  itemId: string,
  menuItemName: string,
  routing_zone: RoutingZone,
  table_name: string,
  quantity: number
): void {
  const event: ItemAddedEvent = {
    type: 'item:added',
    item: {
      id: itemId,
      order_id: '', // Will be filled by caller if needed
      menu_item_id: '',
      quantity,
      status: 'pending' as ItemStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    menu_item: {
      id: '',
      category_id: '',
      name: menuItemName,
      price: 0,
      routing_zone,
      enabled: true,
      created_at: '',
      updated_at: '',
    },
    routing_zone,
  }

  broadcastToZone(event, routing_zone)
}

export function broadcastItemStatusChanged(
  itemId: string,
  oldStatus: ItemStatus,
  newStatus: ItemStatus,
  routing_zone: RoutingZone
): void {
  const event: ItemStatusChangedEvent = {
    type: 'item:status_changed',
    item_id: itemId,
    old_status: oldStatus,
    new_status: newStatus,
    routing_zone,
  }

  // Send to all clients watching this zone
  broadcastToZone(event, routing_zone)
}

export function broadcastQueueSnapshot(routing_zone: RoutingZone): void {
  const queue = getQueueByZone(routing_zone)
  const event: QueueSnapshotEvent = {
    type: 'queue:snapshot',
    routing_zone,
    items: queue,
  }

  broadcastToZone(event, routing_zone)
}

function broadcastToZone(event: WebSocketEvent, routing_zone: RoutingZone): void {
  const message = JSON.stringify(event)

  connectedClients.forEach(client => {
    if (client.routing_zones.has(routing_zone) && client.socket.readyState === 1) {
      // readyState 1 = OPEN
      client.socket.send(message, (err: any) => {
        if (err) {
          console.error(`Error broadcasting to client: ${err.message}`)
        }
      })
    }
  })
}

export function getConnectedClientsCount(): number {
  return connectedClients.length
}
