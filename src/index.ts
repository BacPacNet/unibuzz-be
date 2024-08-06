import mongoose from 'mongoose';
import app from './app';
import config from './config/config';
import logger from './modules/logger/logger';
import { Server as SocketIoServer } from 'socket.io';

let server: any;
let io: any;

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
    io.on('connection', (socket: any) => {
      console.log('A client connected');

      socket.on('disconnect', () => {
        console.log('A client disconnected');
      });
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
