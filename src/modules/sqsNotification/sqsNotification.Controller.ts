import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Request, Response } from 'express';
import config from '../../config/config';

const sqs = new SQSClient({ region: config.aws.region });

export const createSQSNotification = async (req: Request, res: Response) => {
  const { sender_id, receiverId, type } = req.body;
  const message = {
    sender_id,
    receiverId,
    type,
  };

  console.log('message', message);

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: config.sqsQueueUrl,
        MessageBody: JSON.stringify(message),
      })
    );
    res.json({ success: true, message: 'Job enqueued' });
  } catch (err) {
    console.error('❌ Failed to enqueue:', err);
    res.status(500).json({ success: false });
  }
};
