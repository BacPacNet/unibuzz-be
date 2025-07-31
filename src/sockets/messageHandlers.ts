import { Server, Socket } from 'socket.io';
import { Message, ReactedMessage } from './messageTypes';
import { SocketMessageEnums } from './socketEnum';
import { sendMessagePushNotification } from '../modules/pushNotification/pushNotification.service';

export const handleNewMessage = (socket: Socket, io: Server) => {
  socket.on(SocketMessageEnums.RECEIVED_MESSAGE, (newMessageReceived: Message) => {
    const chat = newMessageReceived.chat;
    if (!chat.users) return console.log('chat.users not defined');

    chat.users.forEach((user) => {
      if (user.userId.toString() === newMessageReceived.sender.id) {
        return;
      }

      const room = io.sockets.adapter.rooms.get(user.userId.toString());

      if (room) {
        socket.to(user.userId.toString()).emit(SocketMessageEnums.SEND_MESSAGE, newMessageReceived);
        io.emit(`message_notification_${user.userId}`);
      } else {
        sendMessagePushNotification(
          user.userId.toString(),
          newMessageReceived.sender.firstName || 'User',
          newMessageReceived.content.length ? newMessageReceived.content : 'You have a new message',
          {
            sender_id: newMessageReceived.sender.id,
            receiverId: user.userId.toString(),
            type: 'MESSAGE_NOTIFICATION',
            chatId: newMessageReceived.chat._id,
          }
        );
      }
    });
  });

  socket.on(SocketMessageEnums.REACTED_MESSAGE, (reactedToMessageReceived: ReactedMessage) => {
    const chat = reactedToMessageReceived?.message?.chat?.users;

    if (!chat) return console.log('chat.users not defined');

    chat.forEach((user: any) => {
      if (user.userId === reactedToMessageReceived.sender) {
        return;
      }

      const room = io.sockets.adapter.rooms.get(user.userId);

      if (room) {
        socket.to(user.userId).emit(SocketMessageEnums.REACTED_SEND_MESSAGE, reactedToMessageReceived);
      } else {
        console.log(`User ${user} is not in the room, cannot send message`);
      }
    });
  });
};
