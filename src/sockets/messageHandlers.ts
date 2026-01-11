import { Server, Socket } from 'socket.io';
import { Message, ReactedMessage } from './messageTypes';
import { SocketMessageEnums } from './socketEnum';
import { sendMessagePushNotification } from '../modules/pushNotification/pushNotification.service';
import { OnlineUsers } from './onlineUsers';
import { userProfileService } from '../modules/userProfile';

export const handleNewMessage = (socket: Socket, io: Server, onlineUsers: OnlineUsers) => {
  socket.on(SocketMessageEnums.RECEIVED_MESSAGE, async (newMessageReceived: Message) => {
    const { chat, sender, content } = newMessageReceived;

    if (!chat?.users) {
      return;
    }

    const senderId = sender.id;

    const isBlocked = (profile: any, userId: string) =>
      profile?.blockedUsers?.some((b: any) => b.userId.toString() === userId) || false;

    for (const user of chat.users) {
      const receiverId = user.userId.toString();

      // Skip sender
      if (receiverId === senderId) continue;

      const room = io.sockets.adapter.rooms.get(receiverId);
      const isUserActive = onlineUsers.isUserActive(receiverId);

      // Check if user is online
      if (room && isUserActive) {
        try {
          const [yourUserProfile, theirUserProfile] = await Promise.all([
            userProfileService.getUserProfileById(senderId),
            userProfileService.getUserProfileById(receiverId),
          ]);

          const isBlockedBySender = isBlocked(yourUserProfile, receiverId);
          const isBlockedByReceiver = isBlocked(theirUserProfile, senderId);

          // If blocked, emit message with masked sender name
          if (isBlockedBySender || isBlockedByReceiver) {
            const maskedMessage: Message = {
              ...newMessageReceived,
              sender: {
                ...sender,
                firstName: 'Deleted',
                lastName: '',
              },
              senderProfile: {
                ...newMessageReceived.senderProfile,
                profile_dp: {
                  imageUrl: '',
                  publicId: '',
                },
              },
            };
            socket.to(receiverId).emit(SocketMessageEnums.SEND_MESSAGE, maskedMessage);
            io.emit(`message_notification_${receiverId}`);
            continue;
          }

          // Not blocked, emit normally
          socket.to(receiverId).emit(SocketMessageEnums.SEND_MESSAGE, newMessageReceived);
          io.emit(`message_notification_${receiverId}`);
        } catch (error) {
          console.error('Error checking user profiles:', error);
          socket.to(receiverId).emit(SocketMessageEnums.SEND_MESSAGE, newMessageReceived);
          io.emit(`message_notification_${receiverId}`);
        }
        continue;
      }

      // User is offline
      try {
        const [yourUserProfile, theirUserProfile] = await Promise.all([
          userProfileService.getUserProfileById(senderId),
          userProfileService.getUserProfileById(receiverId),
        ]);

        if (isBlocked(yourUserProfile, receiverId) || isBlocked(theirUserProfile, senderId)) {
          continue;
        }

        await sendMessagePushNotification(
          receiverId,
          sender.firstName || 'User',
          content?.length ? content : 'You have a new message',
          {
            sender_id: senderId,
            receiverId,
            type: 'MESSAGE_NOTIFICATION',
            chatId: chat._id,
          }
        );
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
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
