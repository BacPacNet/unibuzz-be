import { userIdExtend } from 'src/config/userIDType';
import { Response } from 'express';
import httpStatus from 'http-status';
import { openai } from '../../app';
import { communityModel } from '../community';
import { chatbotModel, chatbotService } from '.';

export const createThread = async (_req: userIdExtend, res: Response) => {
  try {
    console.log('Creating a new thread...');
    const thread = await openai.beta.threads.create();
    console.log('thread created', thread);
    return res.status(httpStatus.OK).json(thread);
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const addMessage = async (req: userIdExtend, res: Response) => {
  const { threadId, message } = req.body;
  const communityId = req.query['communityId'];
  try {
    const community = await communityModel.findById(communityId);

    if (!community) {
      return res.status(httpStatus.NOT_FOUND).json({ message: 'Community not found' });
    }
    const { assistantId, collegeID } = community;

    if (!assistantId) {
      return res.status(httpStatus.NOT_FOUND).json({ message: 'Assistant not found' });
    }
    const messageResponse = await chatbotService.addMessageService(threadId, message, assistantId);

    if (messageResponse) {
      const createResponse = {
        userId: req.userId,
        communityId: communityId,
        collegeID: collegeID,
        prompt: message,
        threadId: threadId,
        response: messageResponse[0][0].text.value,
      };

      const result = await chatbotModel.create(createResponse);

      return res.status(httpStatus.OK).json(result);
    }
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};
