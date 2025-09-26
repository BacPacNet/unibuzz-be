import { logger } from '../../modules/logger';
import { getUserById } from '../../modules/user/user.service';
import mongoose from 'mongoose';
import { notificationModel } from '../../modules/Notification';
import { io } from '../../index';
import { sendPushNotification } from '../../modules/pushNotification/pushNotification.service';
import { setTimeout as wait } from 'timers/promises';
import { userProfileService } from '../../modules/userProfile';
import { getCommunityGroup } from '../../modules/communityGroup/communityGroup.service';
import { ApiError } from '../../modules/errors';
import httpStatus from 'http-status';
import { status } from '../../modules/communityGroup/communityGroup.interface';
import { communityGroupService } from '../../modules/communityGroup';

export const handleGroupUsersInviteNotification = async (job: any) => {
  try {
    const { adminId, communityGroupId, receiverIds, type, message } = job;
    logger.info(`Processing notification job: ${type} for ${receiverIds.length} users`);

    // 1️⃣ Create notification documents
    const notifications = receiverIds.map((receiverId: string) => ({
      sender_id: new mongoose.Types.ObjectId(adminId),
      receiverId: new mongoose.Types.ObjectId(receiverId),
      communityGroupId: new mongoose.Types.ObjectId(communityGroupId),
      type,
      message,
    }));

    logger.info(`Inserting ${notifications.length} notifications into database`);
    await notificationModel.insertMany(notifications);
    logger.info('Notifications successfully inserted into database');
    const communityGroupDetails = await communityGroupService.getCommunityGroup(communityGroupId);

    // 2️⃣ Send real-time notifications in batches (avoid blocking the event loop)
    const chunkSize = 100;
    for (let i = 0; i < receiverIds.length; i += chunkSize) {
      const chunk = receiverIds.slice(i, i + chunkSize);
      chunk.forEach((userId: string) => {
        io.emit(`notification_${userId}`, { type });
        sendPushNotification(userId, 'Unibuzz', 'You are invited to join group', {
          sender_id: adminId.toString(),
          receiverId: userId.toString(),
          type: type,
          communityGroupId: communityGroupId,
          communityId: communityGroupDetails?.communityId._id.toString(),
        });
      });
      await wait(10); // debounce between batches
    }

    // 3️⃣ Fetch user and profile data in parallel
    const userPromises = receiverIds.map(async (userID: string) => {
      const [user, userProfile] = await Promise.all([
        getUserById(new mongoose.Types.ObjectId(userID)),
        userProfileService.getUserProfileById(String(userID)),
      ]);

      return { user, userProfile, userID };
    });

    const usersData = await Promise.all(userPromises);

    // 4️⃣ Fetch the community group once
    const communityGroup = await getCommunityGroup(communityGroupId);
    if (!communityGroup) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }

    // 5️⃣ Update community group users array
    usersData.forEach(({ user, userProfile, userID }) => {
      const existingUser = communityGroup.users.find((u) => u._id.equals(userID));
      if (!existingUser) {
        communityGroup.users.push({
          _id: new mongoose.Types.ObjectId(userID),
          firstName: user?.firstName,
          lastName: user?.lastName,
          profileImageUrl: userProfile?.profile_dp?.imageUrl || null,
          universityName: userProfile?.university_name as string,
          year: userProfile?.study_year as string,
          degree: userProfile?.degree as string,
          major: userProfile?.major as string,
          isRequestAccepted: false,
          status: status.pending,
          occupation: userProfile?.occupation as string,
          affiliation: userProfile?.affiliation as string,
          role: userProfile?.role,
        });
      }
    });

    await communityGroup.save();
    logger.info('Community group updated successfully');
    return communityGroup;
  } catch (error) {
    logger.error('Error in handleSendNotification:', error);
    throw error;
  }
};
