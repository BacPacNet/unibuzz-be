import mongoose from 'mongoose';
import app from './app';
import config from './config/config';
import logger from './modules/logger/logger';
import { Server as SocketIoServer, Socket } from 'socket.io';
import { handleNewMessage } from './sockets/messageHandlers';
import { OnlineUsers } from './sockets/onlineUsers';
import { handleConnection } from './sockets/connectionHandler3';
// import { handleConnection2 } from './sockets/connectionHandler2';

// import { handleConnection } from './sockets/connectionHandlers';

let server: any;
let io: any;
const onlineUsers = new OnlineUsers();
mongoose.connect(config.mongoose.url).then(() => {
  logger.info('Connected to MongoDB');
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
    io = new SocketIoServer(server, {
      cors: {
        origin: '*',
      },
    });

    // Socket.io connection handling
    io.on('connection', (socket: Socket) => {
      handleConnection(socket, io, onlineUsers);
      handleNewMessage(socket, io);
    });
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

export { io };

const unexpectedErrorHandler = (error: string) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
