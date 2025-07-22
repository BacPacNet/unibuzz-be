import { Server, Socket } from 'socket.io';
import { OnlineUsers } from './onlineUsers';
import { SocketConnectionEnums } from './socketEnum';
interface releventUsersArray {
  userId: string | undefined;
  userFriends: string[];
}

export const handleConnection = (socket: Socket, io: Server, onlineUsers: OnlineUsers) => {
  let releventUsersArray: releventUsersArray[] = [];
  socket.on(SocketConnectionEnums.SETUP, (userID: string) => {
    socket.userID = userID;
    socket.join(userID);

    onlineUsers.addUser(userID, socket.id);


    // socket.emit(SocketConnectionEnums.CONNECTED, userID);
  });

  socket.on(SocketConnectionEnums.REQUESTONLINEUSERS, (relevantUserIDs: string[]) => {
    if (!relevantUserIDs || relevantUserIDs.length === 0) return;
    releventUsersArray.push({ userId: socket.userID, userFriends: relevantUserIDs });

    const allOnlineUsers = Array.from(onlineUsers.getOnlineUsers());

    const relevantOnlineUsers = allOnlineUsers.filter((id) => relevantUserIDs.includes(id));

    if (socket.userID) {
      io.to(socket.userID).emit(SocketConnectionEnums.ONLINEUSERS, relevantOnlineUsers);
    }

    const userEntry = releventUsersArray.find((entry) => entry.userId === socket.userID);

    if (userEntry) {
      userEntry.userFriends.forEach((friendId) => {
        const friendSocketId = onlineUsers.getSocketId(friendId);
        if (friendSocketId) {
          io.to(friendSocketId).emit(SocketConnectionEnums.ONLINEUSERS2, [socket.userID]);
        }
      });
    }
  });

  socket.on(SocketConnectionEnums.DISCONNECT, () => {
    if (socket.userID) {
      onlineUsers.removeUser(socket.userID);
      const userEntry = releventUsersArray.find((entry) => entry.userId === socket.userID);
      releventUsersArray = releventUsersArray.filter((entry) => entry.userId !== socket.userID);

      if (userEntry) {
        userEntry.userFriends.forEach((friendId) => {
          const friendSocketId = onlineUsers.getSocketId(friendId);
          if (friendSocketId) {
            io.to(friendSocketId).emit(SocketConnectionEnums.USER_DISCONNECT, [socket.userID]);
          }
        });
      }

      socket.leave(socket.userID);
    }
  });
};
