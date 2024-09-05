export enum SocketMessageEnums {
  RECEIVED_MESSAGE = 'new message',
  SEND_MESSAGE = 'message received',
  REACTED_MESSAGE = 'reactedToMessage',
  REACTED_SEND_MESSAGE = 'reaction received',
}

export enum SocketConnectionEnums {
  SETUP = 'setup',
  CONNECTED = 'connected',
  REQUESTONLINEUSERS = 'requestOnlineUsers',
  ONLINEUSERS = 'onlineUsers',
  ONLINEUSERS2 = 'onlineUsers2',
  DISCONNECT = 'disconnect',
  USER_DISCONNECT = 'user-disconnected',
}
