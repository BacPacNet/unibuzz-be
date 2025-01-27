import { userIdExtend } from 'src/config/userIDType';
import { Response } from 'express';
import httpStatus from 'http-status';
import { chatbotService } from './index';
import { openai } from '../../app';

export const createThread = async (_req: userIdExtend, res: Response) => {
  try {
    console.log('Creating a new thread...');
    const thread = await openai.beta.threads.create();
    console.log('thread created', thread);
    res.status(httpStatus.OK).json(thread);
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

export const addMessage = async (req: userIdExtend, res: Response) => {
  const { threadId, message } = req.body;
  try {
    const messageRespone = await chatbotService.addMessageService(threadId, message);
    console.log('messageRespone', messageRespone);
    res.status(httpStatus.OK).send(messageRespone);
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
