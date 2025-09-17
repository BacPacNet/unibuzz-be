// import mongoose from 'mongoose';
// import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
// import config from '../../config/config';
// import { handleFollowNotification, handleLikeNotification, handleCommentNotification } from '../handlers';
// import logger from '../../modules/logger/logger';
// import { NotificationIdentifier } from '../NotificationIdentifierEnums';
// import { handleUserPostLikeNotification } from '../handlers/handleUserPostLikeNotification';
// import { handleUserCommunityPostLikeNotification } from '../handlers/handleUserCommunityPostLikeNotification';
// import { handleUserPostCommentNotification } from '../handlers/handleUserPostCommentNotification';
// import { handleUserCommunityPostCommentNotification } from '../handlers/handleUserCommunityPostCommentNotification';
// import { handleUserFollowNotification } from '../handlers/handleUserFollowNotification';
// import { handleDeleteFollowNotification } from '../handlers/handleDeleteFollowNotification';
// import { setImmediatePollTrigger } from '../sqsWrapperFunction';
// import { handleGroupUsersInviteNotification } from '../handlers/handleGroupUsersInviteNotification';
// import { handleRejectPrivateJoinRequestNotification } from '../handlers/handleRejectPrivateJoinRequestNotification';
// import { handleAcceptPrivateJoinRequestNotification } from '../handlers/handleAcceptPrivateJoinRequestNotification';
// import { handleSendDeleteCommunityGroupNotification } from '../handlers/handleDeleteCommunityGroupNotification';

// const sqs = new SQSClient({ region: config.aws.region });

// let isWorkerRunning = false;
// let workerInterval: NodeJS.Timeout | null = null;
// let lastMessageProcessed = Date.now();
// let watchdogInterval: NodeJS.Timeout | null = null;
// let isProcessingMessages = false; // Guard to prevent concurrent processing
// let immediatePollScheduled = false; // Track if immediate poll is already scheduled
// let immediatePollQueue: (() => void)[] = []; // Queue for immediate polls

// export async function checkQueueMessages() {
//   try {
//     logger.info('🔍 Checking queue for messages...');
//     const response = await sqs.send(
//       new ReceiveMessageCommand({
//         QueueUrl: config.sqsQueueUrl,
//         MaxNumberOfMessages: 10,
//         WaitTimeSeconds: 0, // Don't wait, just check immediately
//         VisibilityTimeout: 30,
//         MessageAttributeNames: ['All'],
//       })
//     );

//     logger.info('📊 Queue check result:', {
//       messageCount: response.Messages?.length || 0,
//       messages:
//         response.Messages?.map((m) => ({
//           messageId: m.MessageId,
//           body: m.Body ? JSON.parse(m.Body) : null,
//         })) || [],
//     });

//     return response.Messages?.length || 0;
//   } catch (err) {
//     logger.error('❌ Queue check failed:', err);
//     return 0;
//   }
// }

// async function testSQSConnection() {
//   try {
//     logger.info('🔍 Testing SQS connection...', {
//       queueUrl: config.sqsQueueUrl,
//       region: config.aws.region,
//     });

//     const response = await sqs.send(
//       new GetQueueAttributesCommand({
//         QueueUrl: config.sqsQueueUrl,
//         AttributeNames: [
//           'ApproximateNumberOfMessages',
//           'ApproximateNumberOfMessagesNotVisible',
//           'VisibilityTimeout',
//           'MessageRetentionPeriod',
//           'ReceiveMessageWaitTimeSeconds',
//           'QueueArn',
//           'CreatedTimestamp',
//           'RedrivePolicy',
//           'DelaySeconds',
//         ],
//       })
//     );

//     logger.info('✅ SQS connection successful');
//     logger.info('📊 Queue status:', {
//       queueUrl: config.sqsQueueUrl,
//       approximateMessages: response.Attributes?.ApproximateNumberOfMessages || '0',
//       approximateInFlight: response.Attributes?.ApproximateNumberOfMessagesNotVisible || '0',
//       visibilityTimeout: response.Attributes?.VisibilityTimeout || '30',
//       messageRetentionPeriod: response.Attributes?.MessageRetentionPeriod || '1209600',
//       receiveMessageWaitTime: response.Attributes?.ReceiveMessageWaitTimeSeconds || '0',
//       queueArn: response.Attributes?.QueueArn,
//       createdTimestamp: response.Attributes?.CreatedTimestamp,
//       isFifo: config.sqsQueueUrl.endsWith('.fifo'),
//       delaySeconds: response.Attributes?.DelaySeconds || '0',
//       redrivePolicy: response.Attributes?.RedrivePolicy || 'None',
//       maxReceiveCount: response.Attributes?.RedrivePolicy
//         ? JSON.parse(response.Attributes.RedrivePolicy).maxReceiveCount
//         : 'N/A',
//     });

//     return true;
//   } catch (err) {
//     logger.error('❌ SQS connection failed:', {
//       error: err,
//       queueUrl: config.sqsQueueUrl,
//       region: config.aws.region,
//     });
//     return false;
//   }
// }

// async function dispatchNotification(data: any) {
//   logger.info('🔍 Dispatching notification:', data);
//   try {
//     switch (data.type) {
//       case 'follow_notification':
//         return handleFollowNotification(data);
//       case 'like_notification':
//         return handleLikeNotification(data);
//       case 'comment_notification':
//         return handleCommentNotification(data);
//       case NotificationIdentifier.REACTED_TO_POST:
//         return await handleUserPostLikeNotification(data);
//         break;
//       case NotificationIdentifier.REACTED_TO_COMMUNITY_POST:
//         return await handleUserCommunityPostLikeNotification(data);
//         break;
//       case NotificationIdentifier.COMMENT:
//         return await handleUserPostCommentNotification(data);
//         break;
//       case NotificationIdentifier.COMMUNITY_COMMENT:
//         return await handleUserCommunityPostCommentNotification(data);
//         break;
//       case NotificationIdentifier.follow_user:
//         return await handleUserFollowNotification(data);
//       case NotificationIdentifier.un_follow_user:
//         return await handleDeleteFollowNotification(data);
//       case NotificationIdentifier.GROUP_INVITE:
//         return await handleGroupUsersInviteNotification(data);
//       case NotificationIdentifier.ACCEPTED_PRIVATE_GROUP_REQUEST:
//         return await handleAcceptPrivateJoinRequestNotification(data);
//       case NotificationIdentifier.REJECTED_PRIVATE_GROUP_REQUEST:
//         return await handleRejectPrivateJoinRequestNotification(data);
//       case NotificationIdentifier.DELETED_COMMUNITY_GROUP:
//         return await handleSendDeleteCommunityGroupNotification(data);
//       default:
//         logger.warn('⚠️ Unknown notification type:', data.type);
//         return null;
//     }
//   } catch (error) {
//     logger.error('❌ Error in dispatchNotification:', error);
//     throw error;
//   }
// }

// // Fixed processMessages function
// async function processMessages(isImmediatePoll = false) {
//   // If processing is already in progress, handle immediate polls differently
//   if (isProcessingMessages) {
//     if (isImmediatePoll) {
//       logger.info('⚡ Immediate poll requested while processing, adding to queue...');
//       // Add to queue for processing after current one completes
//       immediatePollQueue.push(() => {
//         logger.info('🔄 Executing queued immediate poll...');
//         processMessages(true).catch((error) => {
//           logger.error('❌ Error in queued immediate poll:', error);
//         });
//       });
//       logger.info(`📋 Immediate poll queued. Queue length: ${immediatePollQueue.length}`);
//       return;
//     } else {
//       logger.info('⏳ Message processing already in progress, skipping scheduled poll...');
//       return;
//     }
//   }

//   isProcessingMessages = true;
//   immediatePollScheduled = false; // Reset the flag when we start processing

//   try {
//     const pollType = isImmediatePoll ? 'immediate' : 'scheduled';
//     logger.info(`🔍 Polling SQS for messages (${pollType})...`, {
//       queueUrl: config.sqsQueueUrl,
//       timestamp: new Date().toISOString(),
//     });

//     // FIXED: Use consistent long polling for both immediate and scheduled polls
//     const response = await sqs.send(
//       new ReceiveMessageCommand({
//         QueueUrl: config.sqsQueueUrl,
//         MaxNumberOfMessages: 10,
//         WaitTimeSeconds: isImmediatePoll ? 10 : 20, // Shorter wait for immediate, longer for scheduled
//         VisibilityTimeout: 300,
//         MessageAttributeNames: ['All'],
//       })
//     );

//     logger.info(`📊 SQS Response received (${pollType})`, {
//       messageCount: response.Messages?.length || 0,
//       responseMetadata: response.$metadata,
//       timestamp: new Date().toISOString(),
//     });

//     if (response.Messages && response.Messages.length > 0) {
//       lastMessageProcessed = Date.now();
//       logger.info(`📥 Processing ${response.Messages.length} messages`, {
//         pollType,
//         messageIds: response.Messages.map((m) => m.MessageId),
//       });

//       for (const message of response.Messages) {
//         const messageId = message.MessageId;
//         logger.info('📥 Received message', { messageId, pollType });

//         try {
//           const body = JSON.parse(message.Body!);
//           logger.info('📨 Processing message body', { messageId, body, pollType });

//           const result = await dispatchNotification(body);

//           logger.info('✅ Dispatch completed', { messageId, resultId: result?._id });
//           if (!result || !result._id) {
//             logger.error('❌ Notification handler did not return a saved doc', { messageId });
//             continue;
//           }

//           logger.info('📝 Notification saved', {
//             notificationId: result._id.toString(),
//             messageId,
//           });

//           await sqs.send(
//             new DeleteMessageCommand({
//               QueueUrl: config.sqsQueueUrl,
//               ReceiptHandle: message.ReceiptHandle!,
//             })
//           );

//           logger.info('🗑 Message deleted from queue', { messageId });
//         } catch (err) {
//           logger.error('❌ Failed to process message', { messageId, error: err });
//         }
//       }
//     } else {
//       logger.info('📭 No messages in queue');

//       // REMOVED: The problematic follow-up immediate poll that caused infinite loops
//       // The long polling above will catch messages that arrive during the wait period
//     }
//   } catch (err) {
//     logger.error('❌ Polling error:', err);
//   } finally {
//     isProcessingMessages = false;

//     // Process any queued immediate polls
//     if (immediatePollQueue.length > 0) {
//       logger.info(`🔄 Processing ${immediatePollQueue.length} queued immediate polls...`);
//       const nextImmediatePoll = immediatePollQueue.shift();
//       if (nextImmediatePoll) {
//         setImmediate(() => {
//           logger.info('🚀 Executing queued immediate poll...');
//           nextImmediatePoll();
//         });
//       }
//     } else {
//       logger.info('📭 No queued immediate polls to process');
//     }
//   }
// }

// // async function processMessages(isImmediatePoll = false) {
// //   // If processing is already in progress, handle immediate polls differently
// //   if (isProcessingMessages) {
// //     if (isImmediatePoll) {
// //       logger.info('⚡ Immediate poll has priority, interrupting current processing...');
// //       // Immediate polls have priority - interrupt current processing
// //       // The current processing will complete and reset the flag, then immediate poll will run
// //       immediatePollQueue.push(() => {
// //         logger.info('🔄 Executing priority immediate poll...');
// //         processMessages(true).catch((error) => {
// //           logger.error('❌ Error in priority immediate poll:', error);
// //         });
// //       });
// //       logger.info(`📋 Priority immediate poll queued. Queue length: ${immediatePollQueue.length}`);
// //       return;
// //     } else {
// //       logger.info('⏳ Message processing already in progress, skipping scheduled poll...');
// //       return;
// //     }
// //   }

// //   isProcessingMessages = true;
// //   immediatePollScheduled = false; // Reset the flag when we start processing

// //   try {
// //     const pollType = isImmediatePoll ? 'immediate' : 'scheduled';
// //     logger.info(`🔍 Polling SQS for messages (${pollType})...`, {
// //       queueUrl: config.sqsQueueUrl,
// //       timestamp: new Date().toISOString(),
// //     });

// //     // Log queue URL for debugging
// //     logger.info(`🔗 Using queue URL: ${config.sqsQueueUrl}`);

// //     const response = await sqs.send(
// //       new ReceiveMessageCommand({
// //         QueueUrl: config.sqsQueueUrl,
// //         MaxNumberOfMessages: 10,
// //         WaitTimeSeconds: 5,
// //         VisibilityTimeout: 300,
// //         MessageAttributeNames: ['All'],
// //       })
// //     );

// //     logger.info(`📊 SQS Response received (${pollType})`, {
// //       messageCount: response.Messages?.length || 0,
// //       responseMetadata: response.$metadata,
// //       timestamp: new Date().toISOString(),
// //     });

// //     if (response.Messages && response.Messages.length > 0) {
// //       lastMessageProcessed = Date.now(); // Update timestamp when we receive messages
// //       logger.info(`📥 Processing ${response.Messages.length} messages`, {
// //         pollType,
// //         messageIds: response.Messages.map((m) => m.MessageId),
// //       });

// //       for (const message of response.Messages) {
// //         const messageId = message.MessageId;
// //         logger.info('📥 Received message', { messageId, pollType });

// //         try {
// //           const body = JSON.parse(message.Body!);
// //           logger.info('📨 Processing message body', { messageId, body, pollType });

// //           // Dispatch should return the created notification doc
// //           const result = await dispatchNotification(body);

// //           logger.info('✅ Dispatch completed', { messageId, resultId: result?._id });
// //           if (!result || !result._id) {
// //             logger.error('❌ Notification handler did not return a saved doc', { messageId });
// //             // don't delete → message will reappear after visibility timeout
// //             continue;
// //           }

// //           logger.info('📝 Notification saved', {
// //             notificationId: result._id.toString(),
// //             messageId,
// //           });

// //           // Delete only after confirmed DB save
// //           await sqs.send(
// //             new DeleteMessageCommand({
// //               QueueUrl: config.sqsQueueUrl,
// //               ReceiptHandle: message.ReceiptHandle!,
// //             })
// //           );

// //           logger.info('🗑 Message deleted from queue', { messageId });
// //         } catch (err) {
// //           logger.error('❌ Failed to process message', { messageId, error: err });
// //           // don't delete → message will reappear for retry
// //           // Continue processing other messages even if one fails

// //           // If this was an immediate poll and we failed to process a message,
// //           // schedule another immediate poll to retry
// //           if (isImmediatePoll) {
// //             logger.info('🔄 Scheduling retry for immediate poll due to processing error');
// //             setTimeout(() => {
// //               if (isWorkerRunning && !isProcessingMessages) {
// //                 processMessages(true).catch((error) => {
// //                   logger.error('❌ Error in retry immediate poll:', error);
// //                 });
// //               }
// //             }, 1000);
// //           }
// //         }
// //       }
// //     } else {
// //       logger.info('📭 No messages in queue');

// //       // If this was an immediate poll and no messages were found,
// //       // schedule another immediate poll shortly to catch any messages
// //       // that might have been added during processing
// //       if (isImmediatePoll) {
// //         logger.info('🔄 No messages in immediate poll, scheduling follow-up poll...');
// //         setTimeout(() => {
// //           if (isWorkerRunning && !isProcessingMessages) {
// //             processMessages(true).catch((error) => {
// //               logger.error('❌ Error in follow-up immediate poll:', error);
// //             });
// //           }
// //         }, 500);
// //       }
// //     }
// //   } catch (err) {
// //     logger.error('❌ Polling error:', err);
// //     // Don't stop the worker on polling errors, just log and continue
// //   } finally {
// //     isProcessingMessages = false;

// //     // Process any queued immediate polls with high priority
// //     if (immediatePollQueue.length > 0) {
// //       logger.info(`🔄 Processing ${immediatePollQueue.length} queued immediate polls with priority...`);
// //       const nextImmediatePoll = immediatePollQueue.shift();
// //       if (nextImmediatePoll) {
// //         // Use setImmediate to avoid blocking, but ensure it runs before any scheduled polls
// //         setImmediate(() => {
// //           logger.info('🚀 Executing priority queued immediate poll...');
// //           nextImmediatePoll();
// //         });
// //       }
// //     } else {
// //       logger.info('📭 No queued immediate polls to process');
// //     }
// //   }
// // }

// export async function startSQSWorker() {
//   if (isWorkerRunning) {
//     logger.warn('SQS Worker is already running');
//     return;
//   }

//   if (!config.sqsQueueUrl) {
//     logger.warn('⚠️ SQS_QUEUE_URL not configured. SQS Worker will not start.');
//     return;
//   }

//   if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.region) {
//     logger.warn('⚠️ AWS credentials not configured. SQS Worker will not start.');
//     logger.warn('Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION');
//     return;
//   }

//   logger.info('🚀 Starting SQS Worker...');

//   const connectionTest = await testSQSConnection();
//   if (!connectionTest) {
//     logger.error('❌ Failed to connect to SQS. Worker will not start.');
//     return;
//   }

//   isWorkerRunning = true;

//   setImmediatePollTrigger(() => {
//     if (isWorkerRunning) {
//       if (immediatePollScheduled) {
//         logger.info('⚡ Immediate poll already scheduled, skipping duplicate trigger');
//         return;
//       }

//       immediatePollScheduled = true;
//       logger.info('⚡ Immediate poll triggered', {
//         isProcessingMessages,
//         queueLength: immediatePollQueue.length,
//       });

//       // Use a shorter delay for faster processing
//       setTimeout(() => {
//         if (isWorkerRunning) {
//           logger.info('🚀 Executing immediate poll after delay...');
//           processMessages(true).catch((error) => {
//             logger.error('❌ Error in immediate poll:', error);
//           });
//         }
//       }, 50); // Reduced delay to 50ms
//     } else {
//       logger.warn('⚠️ Immediate poll triggered but worker is not running');
//     }
//   });

//   // Start the polling loop with interval
//   workerInterval = setInterval(() => {
//     if (isWorkerRunning) {
//       processMessages().catch((error) => {
//         logger.error('❌ Error in scheduled poll:', error);
//       });
//     }
//   }, 2000); // Poll every 2 seconds

//   // Also do an initial poll to start processing right away, but with a small delay
//   // to ensure the worker is fully initialized
//   setTimeout(() => {
//     if (isWorkerRunning) {
//       logger.info('🚀 Starting initial poll...');
//       processMessages().catch((error) => {
//         logger.error('❌ Error in initial poll:', error);
//       });
//     }
//   }, 1000); // 1 second delay to ensure full initialization

//   logger.info('✅ SQS Worker started successfully');

//   logger.info('🔍 SQS Worker is running and ready to process messages');

//   // Add periodic health check
//   setInterval(() => {
//     if (isWorkerRunning) {
//       logger.info('💓 SQS Worker heartbeat - still running');
//     }
//   }, 60000); // Every minute

//   // Add watchdog to restart worker if it gets stuck
//   watchdogInterval = setInterval(() => {
//     if (isWorkerRunning) {
//       const timeSinceLastMessage = Date.now() - lastMessageProcessed;
//       if (timeSinceLastMessage > 300000) {
//         // 5 minutes without processing
//         logger.warn('⚠️ Worker appears stuck, restarting...');
//         stopSQSWorker();
//         setTimeout(() => {
//           logger.info('🔄 Restarting SQS Worker...');
//           startSQSWorker();
//         }, 2000);
//       }
//     }
//   }, 60000); // Check every minute
// }

// export function stopSQSWorker() {
//   if (!isWorkerRunning) {
//     logger.warn('SQS Worker is not running');
//     return;
//   }

//   isWorkerRunning = false;
//   isProcessingMessages = false; // Reset processing flag
//   immediatePollScheduled = false; // Reset immediate poll flag
//   immediatePollQueue = []; // Clear immediate poll queue
//   logger.info('🛑 Stopping SQS Worker...');

//   if (workerInterval) {
//     clearInterval(workerInterval);
//     workerInterval = null;
//   }

//   if (watchdogInterval) {
//     clearInterval(watchdogInterval);
//     watchdogInterval = null;
//   }

//   logger.info('✅ SQS Worker stopped successfully');
// }

// export async function restartSQSWorker() {
//   logger.info('🔄 Manually restarting SQS Worker...');
//   stopSQSWorker();
//   setTimeout(async () => {
//     await startSQSWorker();
//   }, 2000);
// }

// // For backward compatibility - only run if this file is executed directly
// if (process.argv[1] && process.argv[1].endsWith('worker/index.js')) {
//   mongoose.connect(config.mongoose.url).then(async () => {
//     logger.info('✅ MongoDB connected (Worker)');
//     await startSQSWorker();
//   });
// }

// import mongoose from 'mongoose';
// import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
// import config from '../../config/config';
// import { handleFollowNotification, handleLikeNotification, handleCommentNotification } from '../handlers';
// import logger from '../../modules/logger/logger';
// import { NotificationIdentifier } from '../NotificationIdentifierEnums';
// import { handleUserPostLikeNotification } from '../handlers/handleUserPostLikeNotification';
// import { handleUserCommunityPostLikeNotification } from '../handlers/handleUserCommunityPostLikeNotification';
// import { handleUserPostCommentNotification } from '../handlers/handleUserPostCommentNotification';
// import { handleUserCommunityPostCommentNotification } from '../handlers/handleUserCommunityPostCommentNotification';
// import { handleUserFollowNotification } from '../handlers/handleUserFollowNotification';
// import { handleDeleteFollowNotification } from '../handlers/handleDeleteFollowNotification';
// import { setImmediatePollTrigger } from '../sqsWrapperFunction';
// import { handleGroupUsersInviteNotification } from '../handlers/handleGroupUsersInviteNotification';
// import { handleRejectPrivateJoinRequestNotification } from '../handlers/handleRejectPrivateJoinRequestNotification';
// import { handleAcceptPrivateJoinRequestNotification } from '../handlers/handleAcceptPrivateJoinRequestNotification';
// import { handleSendDeleteCommunityGroupNotification } from '../handlers/handleDeleteCommunityGroupNotification';

// const sqs = new SQSClient({ region: config.aws.region });

// let isWorkerRunning = false;
// let workerInterval: NodeJS.Timeout | null = null;
// let lastMessageProcessed = Date.now();
// let watchdogInterval: NodeJS.Timeout | null = null;
// let isProcessingMessages = false; // Guard to prevent concurrent processing
// let immediatePollScheduled = false; // Track if immediate poll is already scheduled
// let immediatePollQueue: (() => void)[] = []; // Queue for immediate polls

// // FIXED: Updated checkQueueMessages to use long polling
// export async function checkQueueMessages() {
//   try {
//     logger.info('🔍 Checking queue for messages...');
//     const response = await sqs.send(
//       new ReceiveMessageCommand({
//         QueueUrl: config.sqsQueueUrl,
//         MaxNumberOfMessages: 10,
//         WaitTimeSeconds: 5, // CHANGED: From 0 to 5 for long polling consistency
//         VisibilityTimeout: 30,
//         MessageAttributeNames: ['All'],
//       })
//     );

//     logger.info('📊 Queue check result:', {
//       messageCount: response.Messages?.length || 0,
//       messages:
//         response.Messages?.map((m) => ({
//           messageId: m.MessageId,
//           body: m.Body ? JSON.parse(m.Body) : null,
//         })) || [],
//     });

//     return response.Messages?.length || 0;
//   } catch (err) {
//     logger.error('❌ Queue check failed:', err);
//     return 0;
//   }
// }

// async function testSQSConnection() {
//   try {
//     logger.info('🔍 Testing SQS connection...', {
//       queueUrl: config.sqsQueueUrl,
//       region: config.aws.region,
//     });

//     const response = await sqs.send(
//       new GetQueueAttributesCommand({
//         QueueUrl: config.sqsQueueUrl,
//         AttributeNames: [
//           'ApproximateNumberOfMessages',
//           'ApproximateNumberOfMessagesNotVisible',
//           'VisibilityTimeout',
//           'MessageRetentionPeriod',
//           'ReceiveMessageWaitTimeSeconds',
//           'QueueArn',
//           'CreatedTimestamp',
//           'RedrivePolicy',
//           'DelaySeconds',
//         ],
//       })
//     );

//     logger.info('✅ SQS connection successful');
//     logger.info('📊 Queue status:', {
//       queueUrl: config.sqsQueueUrl,
//       approximateMessages: response.Attributes?.ApproximateNumberOfMessages || '0',
//       approximateInFlight: response.Attributes?.ApproximateNumberOfMessagesNotVisible || '0',
//       visibilityTimeout: response.Attributes?.VisibilityTimeout || '30',
//       messageRetentionPeriod: response.Attributes?.MessageRetentionPeriod || '1209600',
//       receiveMessageWaitTime: response.Attributes?.ReceiveMessageWaitTimeSeconds || '0',
//       queueArn: response.Attributes?.QueueArn,
//       createdTimestamp: response.Attributes?.CreatedTimestamp,
//       isFifo: config.sqsQueueUrl.endsWith('.fifo'),
//       delaySeconds: response.Attributes?.DelaySeconds || '0',
//       redrivePolicy: response.Attributes?.RedrivePolicy || 'None',
//       maxReceiveCount: response.Attributes?.RedrivePolicy
//         ? JSON.parse(response.Attributes.RedrivePolicy).maxReceiveCount
//         : 'N/A',
//     });

//     return true;
//   } catch (err) {
//     logger.error('❌ SQS connection failed:', {
//       error: err,
//       queueUrl: config.sqsQueueUrl,
//       region: config.aws.region,
//     });
//     return false;
//   }
// }

// async function dispatchNotification(data: any) {
//   logger.info('🔍 Dispatching notification:', data);
//   try {
//     switch (data.type) {
//       case 'follow_notification':
//         return handleFollowNotification(data);
//       case 'like_notification':
//         return handleLikeNotification(data);
//       case 'comment_notification':
//         return handleCommentNotification(data);
//       case NotificationIdentifier.REACTED_TO_POST:
//         return await handleUserPostLikeNotification(data);
//       case NotificationIdentifier.REACTED_TO_COMMUNITY_POST:
//         return await handleUserCommunityPostLikeNotification(data);
//       case NotificationIdentifier.COMMENT:
//         return await handleUserPostCommentNotification(data);
//       case NotificationIdentifier.COMMUNITY_COMMENT:
//         return await handleUserCommunityPostCommentNotification(data);
//       case NotificationIdentifier.follow_user:
//         return await handleUserFollowNotification(data);
//       case NotificationIdentifier.un_follow_user:
//         return await handleDeleteFollowNotification(data);
//       case NotificationIdentifier.GROUP_INVITE:
//         return await handleGroupUsersInviteNotification(data);
//       case NotificationIdentifier.ACCEPTED_PRIVATE_GROUP_REQUEST:
//         return await handleAcceptPrivateJoinRequestNotification(data);
//       case NotificationIdentifier.REJECTED_PRIVATE_GROUP_REQUEST:
//         return await handleRejectPrivateJoinRequestNotification(data);
//       case NotificationIdentifier.DELETED_COMMUNITY_GROUP:
//         return await handleSendDeleteCommunityGroupNotification(data);
//       default:
//         logger.warn('⚠️ Unknown notification type:', data.type);
//         return null;
//     }
//   } catch (error) {
//     logger.error('❌ Error in dispatchNotification:', error);
//     throw error;
//   }
// }

// // FIXED: Complete processMessages function
// async function processMessages(isImmediatePoll = false) {
//   // If processing is already in progress, handle immediate polls differently
//   if (isProcessingMessages) {
//     if (isImmediatePoll) {
//       logger.info('⚡ Immediate poll requested while processing, adding to queue...');
//       // Add to queue for processing after current one completes
//       immediatePollQueue.push(() => {
//         logger.info('🔄 Executing queued immediate poll...');
//         processMessages(true).catch((error) => {
//           logger.error('❌ Error in queued immediate poll:', error);
//         });
//       });
//       logger.info(`📋 Immediate poll queued. Queue length: ${immediatePollQueue.length}`);
//       return;
//     } else {
//       logger.info('⏳ Message processing already in progress, skipping scheduled poll...');
//       return;
//     }
//   }

//   isProcessingMessages = true;
//   immediatePollScheduled = false; // Reset the flag when we start processing

//   try {
//     const pollType = isImmediatePoll ? 'immediate' : 'scheduled';
//     logger.info(`🔍 Polling SQS for messages (${pollType})...`, {
//       queueUrl: config.sqsQueueUrl,
//       timestamp: new Date().toISOString(),
//     });

//     // FIXED: Use consistent long polling for both immediate and scheduled polls
//     const response = await sqs.send(
//       new ReceiveMessageCommand({
//         QueueUrl: config.sqsQueueUrl,
//         MaxNumberOfMessages: 10,
//         WaitTimeSeconds: isImmediatePoll ? 10 : 20, // Shorter wait for immediate, longer for scheduled
//         VisibilityTimeout: 300,
//         MessageAttributeNames: ['All'],
//       })
//     );

//     logger.info(`📊 SQS Response received (${pollType})`, {
//       messageCount: response.Messages?.length || 0,
//       responseMetadata: response.$metadata,
//       timestamp: new Date().toISOString(),
//     });

//     if (response.Messages && response.Messages.length > 0) {
//       lastMessageProcessed = Date.now();
//       logger.info(`📥 Processing ${response.Messages.length} messages`, {
//         pollType,
//         messageIds: response.Messages.map((m) => m.MessageId),
//       });

//       for (const message of response.Messages) {
//         const messageId = message.MessageId;
//         logger.info('📥 Received message', { messageId, pollType });

//         try {
//           const body = JSON.parse(message.Body!);
//           logger.info('📨 Processing message body', { messageId, body, pollType });

//           const result = await dispatchNotification(body);

//           logger.info('✅ Dispatch completed', { messageId, resultId: result?._id });
//           if (!result || !result._id) {
//             logger.error('❌ Notification handler did not return a saved doc', { messageId });
//             continue;
//           }

//           logger.info('📝 Notification saved', {
//             notificationId: result._id.toString(),
//             messageId,
//           });

//           await sqs.send(
//             new DeleteMessageCommand({
//               QueueUrl: config.sqsQueueUrl,
//               ReceiptHandle: message.ReceiptHandle!,
//             })
//           );

//           logger.info('🗑 Message deleted from queue', { messageId });
//         } catch (err) {
//           logger.error('❌ Failed to process message', { messageId, error: err });
//           // Don't delete message - it will reappear for retry after visibility timeout
//         }
//       }
//     } else {
//       logger.info('📭 No messages in queue');
//       // REMOVED: Follow-up immediate poll logic that caused infinite loops
//       // Long polling with WaitTimeSeconds will handle delayed message availability
//     }
//   } catch (err) {
//     logger.error('❌ Polling error:', err);
//   } finally {
//     isProcessingMessages = false;

//     // Process any queued immediate polls
//     if (immediatePollQueue.length > 0) {
//       logger.info(`🔄 Processing ${immediatePollQueue.length} queued immediate polls...`);
//       const nextImmediatePoll = immediatePollQueue.shift();
//       if (nextImmediatePoll) {
//         setImmediate(() => {
//           logger.info('🚀 Executing queued immediate poll...');
//           nextImmediatePoll();
//         });
//       }
//     } else {
//       logger.info('📭 No queued immediate polls to process');
//     }
//   }
// }

// export async function startSQSWorker() {
//   if (isWorkerRunning) {
//     logger.warn('SQS Worker is already running');
//     return;
//   }

//   if (!config.sqsQueueUrl) {
//     logger.warn('⚠️ SQS_QUEUE_URL not configured. SQS Worker will not start.');
//     return;
//   }

//   if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.region) {
//     logger.warn('⚠️ AWS credentials not configured. SQS Worker will not start.');
//     logger.warn('Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION');
//     return;
//   }

//   logger.info('🚀 Starting SQS Worker...');

//   const connectionTest = await testSQSConnection();
//   if (!connectionTest) {
//     logger.error('❌ Failed to connect to SQS. Worker will not start.');
//     return;
//   }

//   isWorkerRunning = true;

//   // FIXED: Simplified immediate poll trigger
//   setImmediatePollTrigger(() => {
//     if (isWorkerRunning) {
//       if (immediatePollScheduled) {
//         logger.info('⚡ Immediate poll already scheduled, skipping duplicate trigger');
//         return;
//       }
//       immediatePollScheduled = true;
//       logger.info('⚡ Immediate poll triggered');
//       setTimeout(() => {
//         if (isWorkerRunning) {
//           logger.info('🚀 Executing immediate poll...');
//           processMessages(true).catch((err) => logger.error('❌ Error in immediate poll:', err));
//         }
//       }, 300); // throttle
//     }
//   });

//   // Start the polling loop with interval
//   workerInterval = setInterval(() => {
//     if (isWorkerRunning) {
//       processMessages().catch((error) => {
//         logger.error('❌ Error in scheduled poll:', error);
//       });
//     }
//   }, 10000);

//   // Initial poll with delay for initialization
//   setTimeout(() => {
//     if (isWorkerRunning) {
//       logger.info('🚀 Starting initial poll...');
//       processMessages().catch((error) => {
//         logger.error('❌ Error in initial poll:', error);
//       });
//     }
//   }, 1000);

//   logger.info('✅ SQS Worker started successfully');

//   // Add periodic health check
//   setInterval(() => {
//     if (isWorkerRunning) {
//       logger.info('💓 SQS Worker heartbeat - still running');
//     }
//   }, 60000);

//   // Add watchdog to restart worker if it gets stuck
//   watchdogInterval = setInterval(() => {
//     if (isWorkerRunning) {
//       const timeSinceLastMessage = Date.now() - lastMessageProcessed;
//       if (timeSinceLastMessage > 300000) {
//         logger.warn('⚠️ Worker appears stuck, restarting...');
//         stopSQSWorker();
//         setTimeout(() => {
//           logger.info('🔄 Restarting SQS Worker...');
//           startSQSWorker();
//         }, 2000);
//       }
//     }
//   }, 60000);
// }

// export function stopSQSWorker() {
//   if (!isWorkerRunning) {
//     logger.warn('SQS Worker is not running');
//     return;
//   }

//   isWorkerRunning = false;
//   isProcessingMessages = false; // Reset processing flag
//   immediatePollScheduled = false; // Reset immediate poll flag
//   immediatePollQueue = []; // Clear immediate poll queue
//   logger.info('🛑 Stopping SQS Worker...');

//   if (workerInterval) {
//     clearInterval(workerInterval);
//     workerInterval = null;
//   }

//   if (watchdogInterval) {
//     clearInterval(watchdogInterval);
//     watchdogInterval = null;
//   }

//   logger.info('✅ SQS Worker stopped successfully');
// }

// export async function restartSQSWorker() {
//   logger.info('🔄 Manually restarting SQS Worker...');
//   stopSQSWorker();
//   setTimeout(async () => {
//     await startSQSWorker();
//   }, 2000);
// }

// // For backward compatibility - only run if this file is executed directly
// if (process.argv[1] && process.argv[1].endsWith('worker/index.js')) {
//   mongoose.connect(config.mongoose.url).then(async () => {
//     logger.info('✅ MongoDB connected (Worker)');
//     await startSQSWorker();
//   });
// }

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

    const response = await sqs.send(
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
