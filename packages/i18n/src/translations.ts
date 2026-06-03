export type SupportedLocale = 'pt-BR' | 'en-US'

export type NestedRecord = { [key: string]: string | NestedRecord }

const pt: NestedRecord = {
  common: {
    save: 'Salvar', saving: 'Salvando...', saved: 'Salvo', cancel: 'Cancelar', delete: 'Excluir',
    edit: 'Editar', add: 'Adicionar', create: 'Criar', update: 'Atualizar',
    confirm: 'Confirmar', loading: 'Carregando...', close: 'Fechar', search: 'Buscar',
    back: 'Voltar', yes: 'Sim', no: 'Não', total: 'Total', name: 'Nome',
    error: 'Erro', success: 'Sucesso',
  },
  nav: {
    order: 'Pedidos', kitchen: 'Cozinha', bar: 'Bar', cashier: 'Caixa',
    menu: 'Cardápio', tables: 'Mesas', floorMap: 'Mapa do Salão', users: 'Usuários',
    reports: 'Relatórios', settings: 'Configurações', promotions: 'Promoções', combos: 'Combos',
  },
  roles: {
    owner: 'Proprietário', manager: 'Gerente', cashier: 'Caixa',
    waiter: 'Garçom', bartender: 'Barman', kitchen: 'Cozinha',
  },
  auth: {
    login: 'Entrar', logout: 'Sair', username: 'Usuário', password: 'Senha', pin: 'PIN',
    selectUser: 'Selecionar Usuário', signingIn: 'Entrando...',
    pinMinLength: 'PIN deve ter pelo menos 4 dígitos',
    noListUsers: 'Nenhum usuário configurado para login por lista.',
    loginFailed: 'Falha no login',
  },
  orders: {
    title: 'Pedidos', newOrder: 'Novo Pedido', createOrder: 'Criar Pedido',
    closeOrder: 'Fechar Pedido', addItem: 'Adicionar Item', quickAdd: 'Adicionar Rápido',
    table: 'Mesa', selectTable: 'Selecionar mesa', notes: 'Observações',
    quantity: 'Quantidade', noItemsYet: 'Nenhum item adicionado',
    priority: { normal: 'Normal', urgent: 'Urgente', vip: 'VIP' },
    transfer: 'Transferir Mesa', merge: 'Unir Pedidos', split: 'Dividir Conta',
    routingMode: 'Modo de Roteamento', creating: 'Criando...',
    searchItems: 'Buscar itens...', addItems: 'Adicionar Itens',
    orderSummary: 'Resumo do Pedido', qty: 'Qtd', review: 'Revisar',
    draftSection: 'Rascunho', sendWhenOnline: 'Enviar quando online', discard: 'Descartar',
    offlineDraft: 'Você está offline — rascunho local',
    queueFull: 'Fila cheia — máximo 10 pedidos offline',
  },
  queue: {
    kitchen: 'Fila da Cozinha', bar: 'Fila do Bar',
    startCooking: 'Iniciar Preparo', startPrep: 'Iniciar Preparo', markReady: 'Marcar como Pronto',
    noItems: 'Nenhum item na fila', connected: 'Conectado', offline: 'Offline',
    late: 'ATRASADO',
    staleState: 'Offline — exibindo último estado conhecido',
    wsError: 'Erro de conexão WebSocket',
    completedShift: 'Concluídos neste turno',
    wsDisconnected: 'Conexão em tempo real perdida — reconectando...',
    noServer: 'Sem conexão com o servidor.',
    pendingSync: 'pedidos aguardando sincronização. Reconecte antes de continuar.',
  },
  status: {
    pending: 'PENDENTE', preparing: 'PREPARANDO', ready: 'PRONTO', served: 'ENTREGUE',
  },
  cashier: {
    title: 'Caixa', openOrders: 'Pedidos Abertos', closeOrder: 'Fechar Conta',
    paymentMethod: 'Forma de Pagamento', cash: 'Dinheiro', card: 'Cartão',
    noOpenOrders: 'Nenhum pedido aberto',
    closeDay: 'Fechar o Dia', closingDay: 'Fechamento do Dia',
    confirmClose: 'Confirmar Fechamento', ordersOpen: 'Pedidos Abertos',
    ordersClosed: 'Pedidos Fechados', forceClose: 'Forçar Fechamento',
  },
  tables: {
    title: 'Mesas', newTable: 'Nova Mesa', seats: 'Lugares', floorMap: 'Mapa do Salão',
    editor: 'Editor de Mapa', available: 'Disponível', occupied: 'Ocupada',
    transfer: 'Transferir', merge: 'Unir', split: 'Dividir',
    idleAlert: 'Alerta de Mesa Parada', idleAlertMinutes: 'Minutos sem atividade',
  },
  menu: {
    title: 'Cardápio', categories: 'Categorias', newCategory: 'Nova Categoria',
    routingZone: 'Zona de Roteamento', items: 'Itens', newItem: 'Novo Item',
    price: 'Preço', enabled: 'Ativo', disabled: 'Inativo', outOfStock: 'Esgotado',
    activeFrom: 'Ativo das', activeTo: 'até', alwaysActive: 'Sempre ativo',
    variations: 'Variações', addVariationGroup: 'Adicionar Grupo', required: 'Obrigatório',
    priceDelta: 'Diferença de preço',
  },
  users: {
    title: 'Usuários', newUser: 'Novo Usuário', role: 'Perfil',
    loginMethod: 'Método de Login', pin: 'PIN', enabled: 'Ativo',
  },
  reports: {
    title: 'Relatórios', sales: 'Vendas', revenue: 'Receita', period: 'Período',
    topItems: 'Itens Mais Vendidos', exportCsv: 'Exportar CSV',
    orders: 'Pedidos', from: 'De', to: 'Até', groupBy: 'Agrupar por',
    day: 'Dia', week: 'Semana', month: 'Mês',
    waiters: 'Garçons', waiterName: 'Garçom', ordersOpened: 'Pedidos Abertos',
    itemsAdded: 'Itens Adicionados',
    peakHour: 'Horário de Pico', hour: 'Hora',
    comparison: 'Comparativo', currentPeriod: 'Período Atual', previousPeriod: 'Período Anterior',
    vsLastWeek: 'vs. semana passada', vsLastMonth: 'vs. mês passado',
    neverOrdered: 'Nunca Pedidos', category: 'Categoria', price: 'Preço',
    noData: 'Nenhum dado para o período selecionado',
    cancellationRate: 'Taxa de Cancelamento', totalOrders: 'Total de Pedidos',
    cancelledOrders: 'Pedidos Cancelados',
  },
  settings: {
    title: 'Configurações', serverUrl: 'URL do Servidor', language: 'Idioma',
    'pt-BR': 'Português (Brasil)', 'en-US': 'English (US)',
    soundAlerts: 'Alertas Sonoros', soundAlertsDesc: 'Tocar som ao chegar novo item na fila',
    idleAlert: 'Alerta de Mesa Parada',
  },
  setup: {
    title: 'Configurar Servidor',
    subtitle: 'Digite o endereço IP do computador que está executando o servidor Vynex.',
    urlLabel: 'URL do servidor',
    testBtn: 'Testar conexão',
    saveBtn: 'Salvar e continuar',
    serverFound: 'Servidor encontrado',
    connectionFailed: 'Falha ao conectar',
    serverRespondedWith: 'Servidor respondeu com',
    connectionTimeout: 'Conexão esgotou o tempo — verifique se o servidor está rodando e o IP está correto',
  },
}

const en: NestedRecord = {
  common: {
    save: 'Save', saving: 'Saving...', saved: 'Saved', cancel: 'Cancel', delete: 'Delete',
    edit: 'Edit', add: 'Add', create: 'Create', update: 'Update',
    confirm: 'Confirm', loading: 'Loading...', close: 'Close', search: 'Search',
    back: 'Back', yes: 'Yes', no: 'No', total: 'Total', name: 'Name',
    error: 'Error', success: 'Success',
  },
  nav: {
    order: 'Orders', kitchen: 'Kitchen', bar: 'Bar', cashier: 'Cashier',
    menu: 'Menu', tables: 'Tables', floorMap: 'Floor Map', users: 'Users',
    reports: 'Reports', settings: 'Settings', promotions: 'Promotions', combos: 'Combos',
  },
  roles: {
    owner: 'Owner', manager: 'Manager', cashier: 'Cashier',
    waiter: 'Waiter', bartender: 'Bartender', kitchen: 'Kitchen',
  },
  auth: {
    login: 'Sign in', logout: 'Sign out', username: 'Username', password: 'Password', pin: 'PIN',
    selectUser: 'Select User', signingIn: 'Signing in…',
    pinMinLength: 'PIN must be at least 4 digits',
    noListUsers: 'No users configured for list login.',
    loginFailed: 'Login failed',
  },
  orders: {
    title: 'Orders', newOrder: 'New Order', createOrder: 'Create Order',
    closeOrder: 'Close Order', addItem: 'Add Item', quickAdd: 'Quick Add',
    table: 'Table', selectTable: 'Select table', notes: 'Notes',
    quantity: 'Quantity', noItemsYet: 'No items added yet',
    priority: { normal: 'Normal', urgent: 'Urgent', vip: 'VIP' },
    transfer: 'Transfer Table', merge: 'Merge Orders', split: 'Split Bill',
    routingMode: 'Routing Mode', creating: 'Creating...',
    searchItems: 'Search items...', addItems: 'Add Items',
    orderSummary: 'Order Summary', qty: 'Qty', review: 'Review',
    draftSection: 'Draft', sendWhenOnline: 'Send when online', discard: 'Discard',
    offlineDraft: 'You are offline — local draft',
    queueFull: 'Queue full — max 10 offline orders',
  },
  queue: {
    kitchen: 'Kitchen Queue', bar: 'Bar Queue',
    startCooking: 'Start Cooking', startPrep: 'Start Prep', markReady: 'Mark Ready',
    noItems: 'No items in queue', connected: 'Connected', offline: 'Offline',
    late: 'LATE',
    staleState: 'Offline — showing last known state',
    wsError: 'WebSocket connection error',
    completedShift: 'Completed this shift',
    wsDisconnected: 'Real-time connection lost — reconnecting...',
    noServer: 'No server connection.',
    pendingSync: 'orders pending sync. Reconnect before continuing.',
  },
  status: {
    pending: 'PENDING', preparing: 'PREPARING', ready: 'READY', served: 'SERVED',
  },
  cashier: {
    title: 'Cashier', openOrders: 'Open Orders', closeOrder: 'Close Bill',
    paymentMethod: 'Payment Method', cash: 'Cash', card: 'Card',
    noOpenOrders: 'No open orders',
    closeDay: 'Close Day', closingDay: 'Daily Closing',
    confirmClose: 'Confirm Close', ordersOpen: 'Open Orders',
    ordersClosed: 'Closed Orders', forceClose: 'Force Close',
  },
  tables: {
    title: 'Tables', newTable: 'New Table', seats: 'Seats', floorMap: 'Floor Map',
    editor: 'Map Editor', available: 'Available', occupied: 'Occupied',
    transfer: 'Transfer', merge: 'Merge', split: 'Split',
    idleAlert: 'Idle Table Alert', idleAlertMinutes: 'Minutes without activity',
  },
  menu: {
    title: 'Menu', categories: 'Categories', newCategory: 'New Category',
    routingZone: 'Routing Zone', items: 'Items', newItem: 'New Item',
    price: 'Price', enabled: 'Enabled', disabled: 'Disabled', outOfStock: 'Out of Stock',
    activeFrom: 'Active from', activeTo: 'to', alwaysActive: 'Always active',
    variations: 'Variations', addVariationGroup: 'Add Group', required: 'Required',
    priceDelta: 'Price delta',
  },
  users: {
    title: 'Users', newUser: 'New User', role: 'Role',
    loginMethod: 'Login Method', pin: 'PIN', enabled: 'Enabled',
  },
  reports: {
    title: 'Reports', sales: 'Sales', revenue: 'Revenue', period: 'Period',
    topItems: 'Top Items', exportCsv: 'Export CSV',
    orders: 'Orders', from: 'From', to: 'To', groupBy: 'Group by',
    day: 'Day', week: 'Week', month: 'Month',
    waiters: 'Waiters', waiterName: 'Waiter', ordersOpened: 'Orders Opened',
    itemsAdded: 'Items Added',
    peakHour: 'Peak Hours', hour: 'Hour',
    comparison: 'Comparison', currentPeriod: 'Current Period', previousPeriod: 'Previous Period',
    vsLastWeek: 'vs. last week', vsLastMonth: 'vs. last month',
    neverOrdered: 'Never Ordered', category: 'Category', price: 'Price',
    noData: 'No data for the selected period',
    cancellationRate: 'Cancellation Rate', totalOrders: 'Total Orders',
    cancelledOrders: 'Cancelled Orders',
  },
  settings: {
    title: 'Settings', serverUrl: 'Server URL', language: 'Language',
    'pt-BR': 'Português (Brasil)', 'en-US': 'English (US)',
    soundAlerts: 'Sound Alerts', soundAlertsDesc: 'Play sound when a new item arrives in the queue',
    idleAlert: 'Idle Table Alert',
  },
  setup: {
    title: 'Configure Server',
    subtitle: 'Enter the IP address of the computer running the Vynex server.',
    urlLabel: 'Server URL',
    testBtn: 'Test connection',
    saveBtn: 'Save and continue',
    serverFound: 'Server found',
    connectionFailed: 'Connection failed',
    serverRespondedWith: 'Server responded with',
    connectionTimeout: 'Connection timed out — check that the server is running and the IP is correct',
  },
}

export const translations: Record<SupportedLocale, NestedRecord> = { 'pt-BR': pt, 'en-US': en }

export function resolveKey(dict: NestedRecord, key: string): string {
  const parts = key.split('.')
  let cur: string | NestedRecord = dict
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null) return key
    const next: string | NestedRecord | undefined = cur[part]
    if (next === undefined) return key
    cur = next
  }
  return typeof cur === 'string' ? cur : key
}
