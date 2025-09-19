// import { Worker } from 'bullmq';
// import { setTimeout as wait } from 'timers/promises';
// import { io } from '../../../index';
// import mongoose from 'mongoose';
// import { notificationModel, notificationService } from '../../../modules/Notification';
// import { NotificationIdentifier } from '../NotificationEnums';
// import { notificationRoleAccess } from '../../../modules/Notification/notification.interface';
// import { QueuesEnum } from '../../queueEnums';
// import { logger } from '../../../modules/logger';
// import { getUserById } from '../../../modules/user/user.service';
// import { userProfileService } from '../../../modules/userProfile';
// import { getCommunityGroup } from '../../../modules/communityGroup/communityGroup.service';
// import { ApiError } from '../../../modules/errors';
// import httpStatus from 'http-status';
// import { status } from '../../../modules/communityGroup/communityGroup.interface';
// import { redisConnection } from '../notificationQueue';
// import { sendPushNotification } from '../../../modules/pushNotification/pushNotification.service';
// import { communityGroupService } from '../../../modules/communityGroup';
// import config from '../../../config/config';

// // Ensure database connection in worker
// const ensureDatabaseConnection = async () => {
//   if (mongoose.connection.readyState !== 1) {
//     try {
//       await mongoose.connect(config.mongoose.url);
//       logger.info('Database connected in notification worker');
//     } catch (error) {
//       logger.error('Failed to connect to database in notification worker:', error);
//       throw error;
//     }
//   }
// };

// const handleSendNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { adminId, communityGroupId, receiverIds, type, message } = job.data;
//     logger.info(`Processing notification job: ${type} for ${receiverIds.length} users`);

//     // 1️⃣ Create notification documents
//     const notifications = receiverIds.map((receiverId: string) => ({
//       sender_id: new mongoose.Types.ObjectId(adminId),
//       receiverId: new mongoose.Types.ObjectId(receiverId),
//       communityGroupId: new mongoose.Types.ObjectId(communityGroupId),
//       type,
//       message,
//     }));

//     logger.info(`Inserting ${notifications.length} notifications into database`);
//     await notificationModel.insertMany(notifications);
//     logger.info('Notifications successfully inserted into database');

//     // 2️⃣ Send real-time notifications in batches (avoid blocking the event loop)
//     const chunkSize = 100;
//     for (let i = 0; i < receiverIds.length; i += chunkSize) {
//       const chunk = receiverIds.slice(i, i + chunkSize);
//       chunk.forEach((userId: string) => {
//         //   const isUserOnline = onlineUsers.isUserOnline(userId);

//         //   if (isUserOnline) {
//         io.emit(`notification_${userId}`, { type });
//         //   } else {
//         sendPushNotification(userId, 'Unibuzz', 'You are invited to join group', {
//           sender_id: adminId.toString(),
//           receiverId: userId.toString(),
//           type: type,
//         });
//         //   }
//       });
//       await wait(10); // debounce between batches
//     }

//     // 3️⃣ Fetch user and profile data in parallel
//     const userPromises = receiverIds.map(async (userID: string) => {
//       const [user, userProfile] = await Promise.all([
//         getUserById(new mongoose.Types.ObjectId(userID)),
//         userProfileService.getUserProfileById(String(userID)),
//       ]);

//       return { user, userProfile, userID };
//     });

//     const usersData = await Promise.all(userPromises);

//     // 4️⃣ Fetch the community group once
//     const communityGroup = await getCommunityGroup(communityGroupId);
//     if (!communityGroup) {
//       throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
//     }

//     // 5️⃣ Update community group users array
//     usersData.forEach(({ user, userProfile, userID }) => {
//       const existingUser = communityGroup.users.find((u) => u._id.equals(userID));
//       if (!existingUser) {
//         communityGroup.users.push({
//           _id: new mongoose.Types.ObjectId(userID),
//           firstName: user?.firstName,
//           lastName: user?.lastName,
//           profileImageUrl: userProfile?.profile_dp?.imageUrl || null,
//           universityName: userProfile?.university_name as string,
//           year: userProfile?.study_year as string,
//           degree: userProfile?.degree as string,
//           major: userProfile?.major as string,
//           isRequestAccepted: false,
//           status: status.pending,
//           occupation: userProfile?.occupation as string,
//           affiliation: userProfile?.affiliation as string,
//           role: userProfile?.role,
//         });
//       }
//     });

//     await communityGroup.save();
//     logger.info('Community group updated successfully');
//   } catch (error) {
//     logger.error('Error in handleSendNotification:', error);
//     throw error;
//   }
// };

// //const handleSendNotification = async (job: any) => {
// //  const { adminId, communityGroupId, receiverIds, type, message } = job.data;

// //  const notifications = receiverIds.map((receiverId: string) => ({
// //    sender_id: new mongoose.Types.ObjectId(adminId),
// //    receiverId: new mongoose.Types.ObjectId(receiverId),
// //    communityGroupId: new mongoose.Types.ObjectId(communityGroupId),
// //    type,
// //    message,
// //  }));

// //  await notificationModel.create(notifications);

// //  const chunkSize = 100;
// //  for (let i = 0; i < receiverIds.length; i += chunkSize) {
// //    const chunk = receiverIds.slice(i, i + chunkSize);
// //    chunk.forEach((userId: string) => {
// //      io.emit(`notification_${userId}`, { type });
// //    });

// //    await wait(10);
// //  }
// ////  const [user, userProfile] = await Promise.all([
// ////    getUserById(new mongoose.Types.ObjectId(userID)),
// ////    userProfileService.getUserProfileById(String(userID)),
// ////  ]);

// ////  const communityGroup = await getCommunityGroup(groupId);
// ////  if (!communityGroup) {
// ////    throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
// ////  }

// ////  communityGroup.users.push({
// ////    _id: new mongoose.Types.ObjectId(userID),
// ////    firstName: user.firstName,
// ////    lastName: user.lastName,
// ////    profileImageUrl: userProfile.profile_dp?.imageUrl || null,
// ////    universityName: userProfile.university_name as string,
// ////    year: userProfile.study_year as string,
// ////    degree: userProfile.degree as string,
// ////    major: userProfile.major as string,
// ////    isRequestAccepted:  false
// ////    status: status.pending
// ////    occupation: userProfile.occupation as string,
// ////    affiliation: userProfile.affiliation as string,
// ////    role: userProfile.role,
// ////  });
// ////  await communityGroup.save();

// //};

// const handleLikeNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, userPostId } = job.data;
//     logger.info(`Processing like notification for post: ${userPostId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const postObjectId = new mongoose.Types.ObjectId(userPostId);
//     const userData = await getUserById(senderObjectId);

//     let existingNotification = await notificationModel.findOne({
//       receiverId: receiverObjectId,
//       userPostId: postObjectId,
//       type: notificationRoleAccess.REACTED_TO_POST,
//     });

//     if (existingNotification) {
//       let updatedUsers = existingNotification.likedBy?.newFiveUsers || [];

//       const index = updatedUsers.findIndex(
//         (userId: mongoose.Types.ObjectId) => userId.toString() === senderObjectId.toString()
//       );

//       if (index !== -1) {
//         updatedUsers.splice(index, 1);
//       } else {
//         if (updatedUsers.length >= 5) {
//           updatedUsers.pop();
//         }

//         updatedUsers.unshift(senderObjectId);
//       }

//       existingNotification.likedBy.newFiveUsers = updatedUsers;

//       existingNotification.likedBy.totalCount = updatedUsers.length;

//       await existingNotification.save();
//     } else {
//       const newNotification = {
//         receiverId: receiverObjectId,
//         userPostId: postObjectId,
//         type: notificationRoleAccess.REACTED_TO_POST,
//         message: 'Reacted to your post.',
//         likedBy: {
//           totalCount: 1,
//           newFiveUsers: [senderObjectId],
//         },
//       };

//       await notificationService.CreateNotification(newNotification);
//     }

//     io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });

//     const pushMessage =
//       Number(existingNotification?.likedBy?.totalCount) > 1
//         ? `${userData?.firstName} and ${Number(existingNotification?.likedBy?.totalCount) - 1} others liked your post`
//         : `${userData?.firstName} liked your post`;
//     sendPushNotification(receiverId, 'Unibuzz', pushMessage, {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.REACTED_TO_POST,
//       postId: userPostId.toString(),
//     });

//     logger.info('Like notification processed successfully');
//   } catch (error) {
//     logger.error('Error in handleLikeNotification:', error);
//     throw error;
//   }
// };
// const handleCommunityPostLikeNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityPostId } = job.data;
//     logger.info(`Processing like notification for Community post: ${communityPostId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const postObjectId = new mongoose.Types.ObjectId(communityPostId);
//     const userData = await getUserById(senderObjectId);

//     let existingNotification = await notificationModel.findOne({
//       receiverId: receiverObjectId,
//       communityPostId: postObjectId,
//       type: notificationRoleAccess.REACTED_TO_COMMUNITY_POST,
//     });

//     if (existingNotification) {
//       let updatedUsers = existingNotification.likedBy?.newFiveUsers || [];

//       const index = updatedUsers.findIndex(
//         (userId: mongoose.Types.ObjectId) => userId.toString() === senderObjectId.toString()
//       );

//       if (index !== -1) {
//         updatedUsers.splice(index, 1);
//       } else {
//         if (updatedUsers.length >= 5) {
//           updatedUsers.pop();
//         }

//         updatedUsers.unshift(senderObjectId);
//       }

//       existingNotification.likedBy.newFiveUsers = updatedUsers;

//       existingNotification.likedBy.totalCount = updatedUsers.length;

//       await existingNotification.save();
//     } else {
//       const newNotification = {
//         receiverId: receiverObjectId,
//         communityPostId: postObjectId,
//         type: notificationRoleAccess.REACTED_TO_COMMUNITY_POST,
//         message: 'Reacted to your post.',
//         likedBy: {
//           totalCount: 1,
//           newFiveUsers: [senderObjectId],
//         },
//       };

//       await notificationService.CreateNotification(newNotification);
//     }

//     io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });

//     const pushMessage =
//       Number(existingNotification?.likedBy?.totalCount) > 1
//         ? `${userData?.firstName} and ${Number(existingNotification?.likedBy?.totalCount) - 1} others liked your post`
//         : `${userData?.firstName} liked your post`;
//     sendPushNotification(receiverId, 'Notification', pushMessage, {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.REACTED_TO_COMMUNITY_POST,
//       communityPostId: communityPostId.toString(),
//     });
//   } catch (error) {
//     logger.error('Error in handleCommunityPostLikeNotification:', error);
//     throw error;
//   }
// };
// const handleCommentNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, userPostId, postCommentId } = job.data;
//     logger.info(`Processing comment notification for post: ${userPostId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const postObjectId = new mongoose.Types.ObjectId(userPostId);
//     const commentObjectId = new mongoose.Types.ObjectId(postCommentId);
//     const userData = await getUserById(senderObjectId);

//     let existingNotification = await notificationModel.findOne({
//       receiverId: receiverObjectId,
//       userPostId: postObjectId,
//       type: notificationRoleAccess.COMMENT,
//     });

//     const newUserEntry = {
//       _id: senderObjectId,
//       postCommentId: commentObjectId,
//     };

//     if (existingNotification) {
//       let updatedUsers = existingNotification.commentedBy?.newFiveUsers || [];

//       const index = updatedUsers.findIndex((user: any) => user._id.toString() === senderObjectId.toString());

//       if (index !== -1) {
//         updatedUsers.splice(index, 1);
//       } else {
//         if (updatedUsers.length >= 5) {
//           updatedUsers.pop();
//         }
//       }
//       updatedUsers.unshift(newUserEntry);

//       if (existingNotification) {
//         if (!existingNotification.commentedBy) {
//           existingNotification.commentedBy = {
//             totalCount: 0,
//             newFiveUsers: [],
//           };
//         }
//       }

//       await existingNotification.save();
//     } else {
//       const newNotification = {
//         receiverId: receiverObjectId,
//         userPostId: postObjectId,
//         type: notificationRoleAccess.COMMENT,
//         message: 'Commented on your post.',
//         commentedBy: {
//           totalCount: 1,
//           newFiveUsers: [newUserEntry],
//         },
//       };

//       await notificationService.CreateNotification(newNotification);
//     }

//     io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });

//     const pushMessage =
//       Number(existingNotification?.commentedBy?.totalCount) > 1
//         ? `${userData?.firstName} and ${
//             Number(existingNotification?.commentedBy?.totalCount) - 1
//           } others commented on your post`
//         : `${userData?.firstName} commented on your post`;

//     sendPushNotification(receiverId, 'Unibuzz', pushMessage, {
//       type: notificationRoleAccess.COMMENT,
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       commentId: postCommentId.toString(),
//       postId: userPostId.toString(),
//     });
//     //   }
//   } catch (error) {
//     logger.error('Error in handleCommentNotification:', error);
//     throw error;
//   }
// };

// const handleCommunityPostCommentNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityPostId, communityPostCommentId, message } = job.data;
//     logger.info(`Processing comment notification for Community post: ${communityPostId}`);
//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const postObjectId = new mongoose.Types.ObjectId(communityPostId);
//     const commentObjectId = new mongoose.Types.ObjectId(communityPostCommentId);
//     const userData = await getUserById(senderObjectId);

//     let existingNotification = await notificationModel.findOne({
//       receiverId: receiverObjectId,
//       communityPostId: postObjectId,
//       type: notificationRoleAccess.COMMUNITY_COMMENT,
//     });

//     const newUserEntry = {
//       _id: senderObjectId,
//       communityPostCommentId: commentObjectId,
//     };

//     if (existingNotification) {
//       let updatedUsers = existingNotification.commentedBy?.newFiveUsers || [];

//       const index = updatedUsers.findIndex((user: any) => user._id.toString() === senderObjectId.toString());

//       if (index !== -1) {
//         updatedUsers.splice(index, 1);
//       } else if (updatedUsers.length >= 5) {
//         updatedUsers.pop();
//       }

//       updatedUsers.unshift(newUserEntry);

//       if (existingNotification) {
//         if (!existingNotification.commentedBy) {
//           existingNotification.commentedBy = {
//             totalCount: 0,
//             newFiveUsers: [],
//           };
//         }
//       }

//       await existingNotification.save();
//     } else {
//       const newNotification = {
//         receiverId: receiverObjectId,
//         communityPostId: postObjectId,
//         type: notificationRoleAccess.COMMUNITY_COMMENT,
//         communityPostCommentId: commentObjectId,
//         message: message,
//         commentedBy: {
//           totalCount: 1,
//           newFiveUsers: [newUserEntry],
//         },
//       };

//       await notificationService.CreateNotification(newNotification);
//     }

//     io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });

//     const pushMessage =
//       Number(existingNotification?.commentedBy?.totalCount) > 1
//         ? `${userData?.firstName} and ${
//             Number(existingNotification?.commentedBy?.totalCount) - 1
//           } others commented on your post`
//         : `${userData?.firstName} commented on your post`;

//     sendPushNotification(receiverId, 'Unibuzz', pushMessage, {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.COMMUNITY_COMMENT,
//       commentId: communityPostCommentId.toString(),
//       postId: communityPostId.toString(),
//     });
//     //   }
//   } catch (error) {
//     logger.error('Error in handleCommunityPostCommentNotification:', error);
//     throw error;
//   }
// };

// const CreateFollowNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId } = job.data;
//     logger.info(`Processing follow notification for user: ${receiverId}`);
//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

//     const newNotification = {
//       sender_id: senderObjectId,

//       receiverId: receiverObjectId,
//       type: notificationRoleAccess.FOLLOW,
//       message: 'Started following you',
//     };
//     const notification = await notificationService.CreateNotification(newNotification);
//     const res: any = await notification.populate('sender_id');

//     io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.like_notification });

//     sendPushNotification(receiverId, 'Unibuzz', ` ${res?.sender_id?.firstName} started following you`, {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.FOLLOW,
//     });
//   } catch (error) {
//     logger.error('Error in CreateFollowNotification:', error);
//     throw error;
//   }
// };

// const DeleteFollowNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId } = job.data;
//     logger.info(`Processing Deletefollow notification for user: ${receiverId}`);
//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

//     await notificationService.DeleteNotification({
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       type: notificationRoleAccess.FOLLOW,
//     });

//     io.emit(`notification_${receiverId}`, { type: NotificationIdentifier.un_follow_user });
//   } catch (error) {
//     logger.error('Error in DeleteFollowNotification:', error);
//     throw error;
//   }
// };

// const CreateOfficialGroupRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityGroupId, message } = job.data;
//     logger.info(`Processing Official group request notification for communityGroup: ${communityGroupId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.OFFICIAL_GROUP_REQUEST,
//       message: message,
//     };

//     await notificationService.CreateNotification(notifications);

//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.OFFICIAL_GROUP_REQUEST });

//     sendPushNotification(receiverId, 'Unibuzz', message, {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.OFFICIAL_GROUP_REQUEST,
//     });
//     //   }
//   } catch (error) {
//     logger.error('Error in CreateOfficialGroupRequestNotification:', error);
//     throw error;
//   }
// };
// const CreateRejectPrivateJoinRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityGroupId } = job.data;
//     logger.info(`Processing Reject private join request notification for communityGroup: ${communityGroupId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST,
//       message: 'Your Request has been Rejected',
//     };
//     const notification = await notificationService.CreateNotification(notifications);
//     const res: any = await notification.populate('communityGroupId');

//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST });

//     sendPushNotification(
//       receiverId,
//       'Unibuzz',
//       'Your Request to join ' + res?.communityGroupId?.title + ' has been Rejected',
//       {
//         sender_id: sender_id.toString(),
//         receiverId: receiverId.toString(),
//         type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST,
//       }
//     );
//     //   }
//   } catch (error) {
//     logger.error('Error in CreateRejectPrivateJoinRequestNotification:', error);
//     throw error;
//   }
// };
// const CreateAcceptedPrivateJoinRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityGroupId } = job.data;
//     logger.info(`Processing Accepted private join request notification for communityGroup: ${communityGroupId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.ACCEPTED_PRIVATE_GROUP_REQUEST,
//       message: 'Your Request has been Accepted',
//     };
//     const notification = await notificationService.CreateNotification(notifications);
//     const res: any = await notification.populate('communityGroupId');

//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.ACCEPTED_PRIVATE_GROUP_REQUEST });

//     sendPushNotification(
//       receiverId,
//       'Unibuzz',
//       'Your Request to join ' + res?.communityGroupId?.title + ' has been Accepted',
//       {
//         sender_id: sender_id.toString(),
//         receiverId: receiverId.toString(),
//         type: notificationRoleAccess.ACCEPTED_PRIVATE_GROUP_REQUEST,
//       }
//     );
//     //   }
//   } catch (error) {
//     logger.error('Error in CreateAcceptedPrivateJoinRequestNotification:', error);
//     throw error;
//   }
// };
// const CreateAcceptedOfficialGroupRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();
//     const { sender_id, receiverId, communityGroupId, message } = job.data;
//     logger.info(`Processing Accepted official group request notification for community group: ${communityGroupId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST,
//       message: message,
//     };
//     await notificationService.CreateNotification(notifications);

//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST });
//     sendPushNotification(receiverId, 'Unibuzz', message, {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST,
//     });
//     //   }
//   } catch (error) {
//     logger.error('Error in CreateAcceptedOfficialGroupRequestNotification:', error);
//     throw error;
//   }
// };
// const CreateRejectedOfficialGroupRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityGroupId, message } = job.data;
//     logger.info(`Processing Rejected official group request notification for community group: ${communityGroupId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);

//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.REJECTED_OFFICIAL_GROUP_REQUEST,
//       message: message,
//     };

//     await notificationService.CreateNotification(notifications);

//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.REJECTED_OFFICIAL_GROUP_REQUEST });
//     sendPushNotification(receiverId, 'Unibuzz', message, {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.REJECTED_OFFICIAL_GROUP_REQUEST,
//     });

//     await communityGroupService.RejectCommunityGroupApproval(groupObjectId);
//     //   }
//   } catch (error) {
//     logger.error('Error in CreateRejectedOfficialGroupRequestNotification:', error);
//     throw error;
//   }
// };

// const CreatePostLiveRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityGroupId, message, communityPostId } = job.data;
//     logger.info(`Processing Post live request notification for communityPost: ${communityPostId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);
//     const postObjectId = new mongoose.Types.ObjectId(communityPostId);

//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.community_post_live_request_notification,
//       message: message,
//       communityPostId: postObjectId,
//     };

//     const notification = await notificationService.CreateNotification(notifications);

//     const res: any = await notification.populate('communityGroupId');

//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.community_post_live_request_notification });
//     sendPushNotification(
//       receiverId,
//       'Unibuzz',
//       res?.communityGroupId?.title + ' has requested an live status for his post',
//       {
//         sender_id: sender_id.toString(),
//         receiverId: receiverId.toString(),
//         type: notificationRoleAccess.community_post_live_request_notification,
//       }
//     );
//   } catch (error) {
//     logger.error('Error in CreatePostLiveRequestNotification:', error);
//     throw error;
//   }
// };
// const CreatePostAcceptRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityGroupId, message, communityPostId } = job.data;
//     logger.info(`Processing Post accept request notification for communityPost: ${communityPostId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);
//     const postObjectId = new mongoose.Types.ObjectId(communityPostId);
//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.community_post_accepted_notification,
//       message: message,
//       communityPostId: postObjectId,
//     };

//     await notificationService.CreateNotification(notifications);
//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.community_post_accepted_notification });
//     sendPushNotification(receiverId, 'Unibuzz', ' Your post is approved', {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.community_post_accepted_notification,
//     });
//   } catch (error) {
//     logger.error('Error in CreatePostAcceptRequestNotification:', error);
//     throw error;
//   }
// };

// const CreatePostRejectRequestNotification = async (job: any) => {
//   try {
//     // Ensure database connection before processing
//     await ensureDatabaseConnection();

//     const { sender_id, receiverId, communityGroupId, message, communityPostId } = job.data;
//     logger.info(`Processing Post reject request notification for communityPost: ${communityPostId}`);

//     const senderObjectId = new mongoose.Types.ObjectId(sender_id);
//     const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
//     const groupObjectId = new mongoose.Types.ObjectId(communityGroupId);
//     const postObjectId = new mongoose.Types.ObjectId(communityPostId);
//     const notifications = {
//       sender_id: senderObjectId,
//       receiverId: receiverObjectId,
//       communityGroupId: groupObjectId,
//       type: notificationRoleAccess.community_post_rejected_notification,
//       message: message,
//       communityPostId: postObjectId,
//     };

//     await notificationService.CreateNotification(notifications);
//     io.emit(`notification_${receiverId}`, { type: notificationRoleAccess.community_post_rejected_notification });
//     sendPushNotification(receiverId, 'Unibuzz', ' Your post is Rejected', {
//       sender_id: sender_id.toString(),
//       receiverId: receiverId.toString(),
//       type: notificationRoleAccess.community_post_rejected_notification,
//     });
//   } catch (error) {
//     logger.error('Error in CreatePostRejectRequestNotification:', error);
//     throw error;
//   }
// };

// export const notificationWorker = new Worker(
//   QueuesEnum.notification_queue,
//   async (job) => {
//     try {
//       // Ensure database connection for each job
//       await ensureDatabaseConnection();

//       switch (job.name) {
//         case NotificationIdentifier.send_notification:
//           await handleSendNotification(job);
//           break;

//         case NotificationIdentifier.like_notification:
//           await handleLikeNotification(job);
//           break;
//         case NotificationIdentifier.community_post_like_notification:
//           await handleCommunityPostLikeNotification(job);
//           break;
//         case NotificationIdentifier.comment_notification:
//           await handleCommentNotification(job);
//           break;
//         case NotificationIdentifier.community_post_comment_notification:
//           await handleCommunityPostCommentNotification(job);
//           break;
//         case NotificationIdentifier.follow_user:
//           await CreateFollowNotification(job);
//           break;
//         case NotificationIdentifier.un_follow_user:
//           await DeleteFollowNotification(job);
//           break;
//         case NotificationIdentifier.official_group_request:
//           await CreateOfficialGroupRequestNotification(job);
//           break;
//         case NotificationIdentifier.reject_private_join_group_request:
//           await CreateRejectPrivateJoinRequestNotification(job);
//           break;
//         case NotificationIdentifier.accept_private_join_group_request:
//           await CreateAcceptedPrivateJoinRequestNotification(job);
//           break;
//         case NotificationIdentifier.reject_official_group_request:
//           await CreateRejectedOfficialGroupRequestNotification(job);
//           break;
//         case NotificationIdentifier.accept_official_group_request:
//           await CreateAcceptedOfficialGroupRequestNotification(job);
//           break;
//         case NotificationIdentifier.group_invite_notifications:
//           await handleSendNotification(job);
//           break;
//         case NotificationIdentifier.delete_community_group:
//           await handleSendNotification(job);
//           break;
//         case NotificationIdentifier.community_post_live_request_notification:
//           await CreatePostLiveRequestNotification(job);
//           break;
//         case NotificationIdentifier.community_post_rejected_notification:
//           await CreatePostRejectRequestNotification(job);
//           break;
//         case NotificationIdentifier.community_post_accepted_notification:
//           await CreatePostAcceptRequestNotification(job);
//           break;
//         default:
//           console.warn(`Unknown job name: ${job.name}`);
//       }
//     } catch (error) {
//       logger.error(`Error processing job ${job.name}:`, error);
//       throw error;
//     }
//   },
//   { connection: redisConnection }
// );

// notificationWorker.on('ready', () => {
//   logger.info('Notification Worker ready');
// });

// notificationWorker.on('failed', (_, err) => {
//   console.error('Notification job failed:', err);
// });
