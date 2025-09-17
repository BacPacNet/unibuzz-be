import mongoose from 'mongoose';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import config from '../../config/config';
import { handleFollowNotification, handleLikeNotification, handleCommentNotification } from '../handlers';
import logger from '../../modules/logger/logger';
import { NotificationIdentifier } from '../NotificationIdentifierEnums';
import { handleUserPostLikeNotification } from '../handlers/handleUserPostLikeNotification';
import { handleUserCommunityPostLikeNotification } from '../handlers/handleUserCommunityPostLikeNotification';
import { handleUserPostCommentNotification } from '../handlers/handleUserPostCommentNotification';
import { handleUserCommunityPostCommentNotification } from '../handlers/handleUserCommunityPostCommentNotification';
import { handleUserFollowNotification } from '../handlers/handleUserFollowNotification';
import { handleDeleteFollowNotification } from '../handlers/handleDeleteFollowNotification';
import { handleGroupUsersInviteNotification } from '../handlers/handleGroupUsersInviteNotification';
import { handleRejectPrivateJoinRequestNotification } from '../handlers/handleRejectPrivateJoinRequestNotification';
import { handleAcceptPrivateJoinRequestNotification } from '../handlers/handleAcceptPrivateJoinRequestNotification';
import { handleSendDeleteCommunityGroupNotification } from '../handlers/handleDeleteCommunityGroupNotification';

const sqs = new SQSClient({ region: config.aws.region });

let isWorkerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;
let lastMessageProcessed = Date.now();
let watchdogInterval: NodeJS.Timeout | null = null;
let isProcessingMessages = false; // Guard to prevent concurrent processing

// Long-polling check
export async function checkQueueMessages() {
  try {
    logger.info('🔍 Checking queue for messages...');
    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: config.sqsQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 10,
        VisibilityTimeout: 30,
        MessageAttributeNames: ['All'],
      })
    );

    logger.info('📊 Queue check result:', {
      messageCount: response.Messages?.length || 0,
      messages:
        response.Messages?.map((m) => ({
          messageId: m.MessageId,
          body: m.Body ? JSON.parse(m.Body) : null,
        })) || [],
    });

    return response.Messages?.length || 0;
  } catch (err) {
    logger.error('❌ Queue check failed:', err);
    return 0;
  }
}

async function testSQSConnection() {
  try {
    logger.info('🔍 Testing SQS connection...', {
      queueUrl: config.sqsQueueUrl,
      region: config.aws.region,
    });

    await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: config.sqsQueueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'VisibilityTimeout',
          'MessageRetentionPeriod',
          'ReceiveMessageWaitTimeSeconds',
          'QueueArn',
          'CreatedTimestamp',
          'RedrivePolicy',
          'DelaySeconds',
        ],
      })
    );

    logger.info('✅ SQS connection successful');

    return true;
  } catch (err) {
    logger.error('❌ SQS connection failed:', {
      error: err,
      queueUrl: config.sqsQueueUrl,
      region: config.aws.region,
    });
    return false;
  }
}

async function dispatchNotification(data: any) {
  try {
    switch (data.type) {
      case 'follow_notification':
        return handleFollowNotification(data);
      case 'like_notification':
        return handleLikeNotification(data);
      case 'comment_notification':
        return handleCommentNotification(data);
      case NotificationIdentifier.REACTED_TO_POST:
        return await handleUserPostLikeNotification(data);
      case NotificationIdentifier.REACTED_TO_COMMUNITY_POST:
        return await handleUserCommunityPostLikeNotification(data);
      case NotificationIdentifier.COMMENT:
        return await handleUserPostCommentNotification(data);
      case NotificationIdentifier.COMMUNITY_COMMENT:
        return await handleUserCommunityPostCommentNotification(data);
      case NotificationIdentifier.follow_user:
        return await handleUserFollowNotification(data);
      case NotificationIdentifier.un_follow_user:
        return await handleDeleteFollowNotification(data);
      case NotificationIdentifier.GROUP_INVITE:
        return await handleGroupUsersInviteNotification(data);
      case NotificationIdentifier.ACCEPTED_PRIVATE_GROUP_REQUEST:
        return await handleAcceptPrivateJoinRequestNotification(data);
      case NotificationIdentifier.REJECTED_PRIVATE_GROUP_REQUEST:
        return await handleRejectPrivateJoinRequestNotification(data);
      case NotificationIdentifier.DELETED_COMMUNITY_GROUP:
        return await handleSendDeleteCommunityGroupNotification(data);
      default:
        logger.warn('⚠️ Unknown notification type:', data.type);
        return null;
    }
  } catch (error) {
    logger.error('❌ Error in dispatchNotification:', error);
    throw error;
  }
}

// Core polling loop
async function processMessages() {
  if (isProcessingMessages) {
    logger.debug('⏳ Message processing already in progress, skipping this poll...');
    return;
  }

  isProcessingMessages = true;

  try {
    logger.info('🔍 Polling SQS for messages (scheduled)...', {
      queueUrl: config.sqsQueueUrl,
      timestamp: new Date().toISOString(),
    });

    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: config.sqsQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20, // Long poll
        VisibilityTimeout: 300,
        MessageAttributeNames: ['All'],
      })
    );

    logger.info('📊 SQS Response received', {
      messageCount: response.Messages?.length || 0,
      responseMetadata: response.$metadata,
      timestamp: new Date().toISOString(),
    });

    if (response.Messages && response.Messages.length > 0) {
      lastMessageProcessed = Date.now();
      logger.info(`📥 Processing ${response.Messages.length} messages`, {
        messageIds: response.Messages.map((m) => m.MessageId),
      });

      for (const message of response.Messages) {
        const messageId = message.MessageId;
        try {
          const body = JSON.parse(message.Body!);
          logger.info('📨 Processing message body', { messageId, body });

          const result = await dispatchNotification(body);

          if (result?._id) {
            logger.info('✅ Notification saved', {
              notificationId: result._id.toString(),
              messageId,
            });
          } else {
            logger.error('❌ Handler did not return a saved doc', { messageId });
            continue;
          }

          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: config.sqsQueueUrl,
              ReceiptHandle: message.ReceiptHandle!,
            })
          );

          logger.info('🗑 Message deleted from queue', { messageId });
        } catch (err) {
          logger.error('❌ Failed to process message', { messageId, error: err });
          // Message will reappear after visibility timeout
        }
      }
    } else {
      logger.debug('📭 No messages in queue');
    }
  } catch (err) {
    logger.error('❌ Polling error:', err);
  } finally {
    isProcessingMessages = false;
  }
}

export async function startSQSWorker() {
  if (isWorkerRunning) {
    logger.warn('SQS Worker is already running');
    return;
  }

  if (!config.sqsQueueUrl) {
    logger.warn('⚠️ SQS_QUEUE_URL not configured. Worker will not start.');
    return;
  }

  if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.region) {
    logger.warn('⚠️ AWS credentials not configured. Worker will not start.');
    return;
  }

  logger.info('🚀 Starting SQS Worker...');

  const connectionTest = await testSQSConnection();
  if (!connectionTest) {
    logger.error('❌ Failed to connect to SQS. Worker will not start.');
    return;
  }

  isWorkerRunning = true;

  // Start scheduled polling loop
  workerInterval = setInterval(() => {
    if (isWorkerRunning) {
      processMessages().catch((error) => {
        logger.error('❌ Error in scheduled poll:', error);
      });
    }
  }, 10000); // every 10 seconds

  // Initial poll
  setTimeout(() => {
    if (isWorkerRunning) {
      logger.info('🚀 Starting initial poll...');
      processMessages().catch((error) => {
        logger.error('❌ Error in initial poll:', error);
      });
    }
  }, 1000);

  logger.info('✅ SQS Worker started successfully');

  // Heartbeat
  setInterval(() => {
    if (isWorkerRunning) {
      logger.info('💓 SQS Worker heartbeat - still running');
    }
  }, 60000);

  // Watchdog
  watchdogInterval = setInterval(() => {
    if (isWorkerRunning) {
      const timeSinceLastMessage = Date.now() - lastMessageProcessed;
      if (timeSinceLastMessage > 300000) {
        logger.warn('⚠️ Worker appears stuck, restarting...');
        stopSQSWorker();
        setTimeout(() => {
          logger.info('🔄 Restarting SQS Worker...');
          startSQSWorker();
        }, 2000);
      }
    }
  }, 60000);
}

export function stopSQSWorker() {
  if (!isWorkerRunning) {
    logger.warn('SQS Worker is not running');
    return;
  }

  isWorkerRunning = false;
  isProcessingMessages = false;
  logger.info('🛑 Stopping SQS Worker...');

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }

  logger.info('✅ SQS Worker stopped successfully');
}

export async function restartSQSWorker() {
  logger.info('🔄 Manually restarting SQS Worker...');
  stopSQSWorker();
  setTimeout(async () => {
    await startSQSWorker();
  }, 2000);
}

// Run directly
if (process.argv[1] && process.argv[1].endsWith('worker/index.js')) {
  mongoose.connect(config.mongoose.url).then(async () => {
    logger.info('✅ MongoDB connected (Worker)');
    await startSQSWorker();
  });
}
