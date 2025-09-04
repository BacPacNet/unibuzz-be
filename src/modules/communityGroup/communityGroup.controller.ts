import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityGroupModel, communityGroupService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { User } from '../user';

import { CommunityGroupAccess } from '../../config/community.type';
import { status } from './communityGroup.interface';
import { notificationRoleAccess, notificationStatus } from '../Notification/notification.interface';
import { notificationService } from '../Notification';
import { notificationQueue } from '../../bullmq/Notification/notificationQueue';
import { NotificationIdentifier } from '../../bullmq/Notification/NotificationEnums';
import { communityService } from '../community';

interface extendedRequest extends Request {
  userId?: string;
}

export const CreateCommunityGroup = async (req: extendedRequest, res: Response) => {
  const userId = req.userId;
  const { communityId } = req.params;
  const { body } = req;
  const isOfficial = body.communityGroupType.toLowerCase() === 'official';

  try {
    if (!communityId || !userId) {
      return new ApiError(httpStatus.BAD_REQUEST, 'Community ID is required');
    }
    const community = await communityService.getCommunity(communityId);
    if (!community) {
      return res.status(httpStatus.NOT_FOUND).json({ message: 'Community not found' });
    }
    const isAdminOfCommunity = community.adminId.toString() === userId;

    const getCommunityByName = await communityGroupModel.findOne({ title: body.title });
    if (getCommunityByName?.title) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Community group already exists' });
    }
    const createCommunityGroup = await communityGroupService.createCommunityGroup(
      body,
      communityId,
      userId,
      isOfficial,
      isAdminOfCommunity
    );

    if (isOfficial && community?.adminId.toString() !== userId) {
      const notifications = {
        sender_id: userId,
        receiverId: community?.adminId,
        communityGroupId: createCommunityGroup._id,
        type: notificationRoleAccess.OFFICIAL_GROUP_REQUEST,
        message: body.title + ' in ' + community?.name,
      };

      await notificationQueue.add(NotificationIdentifier.official_group_request, notifications);
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully created the community group',
      data: createCommunityGroup,
    });
  } catch (error: any) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateCommunityGroup = async (req: Request, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  try {
    if (typeof groupId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
      }
      // console.log('body', body);
      await communityGroupService.updateCommunityGroup(new mongoose.Types.ObjectId(groupId), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateCommunityGroupJoinRequest = async (req: extendedRequest, res: Response) => {
  const { groupId } = req.params as any;
  const { notificationId, status: reqStatus, userId, adminId, communityGroupId } = req.body;

  try {
    if (!groupId || !userId) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid group ID or user ID' });
    }
    if (reqStatus == status.rejected) {
      await communityGroupService.rejectCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
      await notificationService.changeNotificationStatus(notificationStatus.rejected, notificationId);
      const notifications = {
        sender_id: adminId,
        receiverId: userId,
        communityGroupId: communityGroupId,
        type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST,
        message: 'Your Request has been Rejected',
      };

      await notificationQueue.add(NotificationIdentifier.reject_private_join_group_request, notifications);
    }
    if (reqStatus == status.accepted) {
      await communityGroupService.acceptCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
      await notificationService.changeNotificationStatus(notificationStatus.accepted, notificationId);
      const notifications = {
        sender_id: adminId,
        receiverId: userId,
        communityGroupId: communityGroupId,
        type: notificationRoleAccess.ACCEPTED_PRIVATE_GROUP_REQUEST,
        message: 'Your Request has been Accepted',
      };

      await notificationQueue.add(NotificationIdentifier.accept_private_join_group_request, notifications);
    }
    return res.status(200).json({ message: 'Status Updated Successfully' });
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
export const changeCommunityGroupStatus = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const { groupId } = req.params;
  const { communityGroupId, adminId, userId, text } = req.body;
  const communityAdminId = req.userId as string;

  try {
    if (typeof groupId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID'));
      }
      if (req.body.status == status.rejected) {
        // await communityGroupService.RejectCommunityGroupApproval(new mongoose.Types.ObjectId(groupId));
        await notificationService.changeNotificationStatus(notificationStatus.rejected, req.body.notificationId);
        const notifications = {
          sender_id: adminId,
          receiverId: userId,
          communityGroupId: communityGroupId,
          type: notificationRoleAccess.REJECTED_OFFICIAL_GROUP_REQUEST,
          message: text,
        };

        await notificationQueue.add(NotificationIdentifier.reject_official_group_request, notifications);
      }
      if (req.body.status == status.accepted) {
        await communityGroupService.AcceptCommunityGroupApproval(new mongoose.Types.ObjectId(groupId), communityAdminId);
        await notificationService.changeNotificationStatus(notificationStatus.accepted, req.body.notificationId);
        const notifications = {
          sender_id: adminId,
          receiverId: userId,
          communityGroupId: communityGroupId,
          type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST,
          message: text,
        };

        await notificationQueue.add(NotificationIdentifier.accept_official_group_request, notifications);
      }
      return res.status(200).json({ message: 'Status Updated Successfully' });
    }
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const deleteCommunityGroup = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  try {
    const deleteCommunityGroup = await communityGroupService.deleteCommunityGroup(new mongoose.Types.ObjectId(groupId));
    return res.status(200).json(deleteCommunityGroup);
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getCommunityGroupById = async (req: extendedRequest, res: Response) => {
  const { communityGroupId } = req.query;
  const userId = req.userId;

  try {
    const communityGroup = await communityGroupService.getCommunityGroupById(communityGroupId as string, userId as string);

    if (
      communityGroup.communityId.adminId.toString() == userId?.toString() ||
      communityGroup.adminUserId.toString() == userId?.toString()
    ) {
      const findNotificationByCommunityGroupId = await notificationService.findNotificationByCommunityGroupId(
        communityGroupId as string,
        communityGroup.communityId.adminId.toString() || '',
        communityGroup.adminUserId.toString()
      );
      (communityGroup as any).notificationId = findNotificationByCommunityGroupId?._id;
      (communityGroup as any).notificationTypes = findNotificationByCommunityGroupId?.type;
      (communityGroup as any).notificationStatus = findNotificationByCommunityGroupId?.status;
    } else {
      const findNotificationByCommunityGroupId = await notificationService.findNotificationByCommunityGroupId(
        communityGroupId as string,
        userId?.toString() || '',
        communityGroup.adminUserId.toString()
      );
      (communityGroup as any).notificationId = findNotificationByCommunityGroupId?._id;
      (communityGroup as any).notificationTypes = findNotificationByCommunityGroupId?.type;
      (communityGroup as any).notificationStatus = findNotificationByCommunityGroupId?.status;
    }

    if (!communityGroup) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, message: 'Community group not found' });
    }
    return res.status(httpStatus.OK).json(communityGroup);
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getAllCommunityGroup = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const { communityId } = req.params;
  const { communityGroupId } = req.query;
  let groups;
  let access = CommunityGroupAccess.Public;
  try {
    if (communityId) {
      const user = await User.findById(req.userId);

      const userVerifiedCommunityIds = user?.userVerifiedCommunities.map((c) => c.communityId.toString()) || [];
      const userUnverifiedVerifiedCommunityIds = user?.userUnVerifiedCommunities.map((c) => c.communityId.toString()) || [];

      if (
        !userUnverifiedVerifiedCommunityIds.includes(String(communityId)) &&
        !userVerifiedCommunityIds.includes(String(communityId))
      ) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Join the community to view the Groups!'));
      }

      if (userUnverifiedVerifiedCommunityIds.includes(String(communityId))) {
        access = CommunityGroupAccess.Public;
      }
      if (userVerifiedCommunityIds.includes(String(communityId))) {
        access = CommunityGroupAccess.Private;
      }
      groups = await communityGroupService.getAllCommunityGroupWithUserProfiles(communityId, access);

      if (communityGroupId) {
        const group = groups.find((g) => g._id.toString() === communityGroupId);
        if (!group) {
          return next(new ApiError(httpStatus.NOT_FOUND, 'Group not found'));
        }
        return res.status(httpStatus.OK).json(group);
      } else {
        return res.status(httpStatus.OK).json(groups);
      }
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const joinCommunityGroup = async (req: extendedRequest, res: Response) => {
  const userID = req.userId as string;
  const { groupId } = req.params;
  try {
    const updatedCommunity = await communityGroupService.joinCommunityGroup(userID, groupId as string);
    return res.status(200).json(updatedCommunity);
  } catch (error: any) {
    console.error(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const acceptPrivateCommunityGroupRequest = async (req: extendedRequest, res: Response) => {
  const { groupId, userId } = req.params as any;
  const { notificationId, status: reqStatus } = req.body;
  try {
    if (!groupId) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid group ID' });
    }
    if (reqStatus == status.rejected) {
      await communityGroupService.rejectCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
      await notificationService.changeNotificationStatus(notificationStatus.rejected, notificationId);
    }
    if (reqStatus == status.accepted) {
      await communityGroupService.acceptCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
      await notificationService.changeNotificationStatus(notificationStatus.accepted, notificationId);
    }
    return res.status(200).json({ message: 'Status Updated Successfully' });
  } catch (error: any) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const leaveCommunityGroup = async (req: extendedRequest, res: Response) => {
  const userID = req.userId as string;
  const { groupId } = req.params;
  try {
    const updatedCommunity = await communityGroupService.leaveCommunityGroup(userID, groupId as string);

    res.status(200).json({
      success: true,
      message: 'Successfully left the community group',
      data: updatedCommunity,
    });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const removeUserFromCommunityGroup = async (req: extendedRequest, res: Response) => {
  const adminId = req.userId as string;
  const { groupId, userId } = req.params;
  try {
    // Check if the adminUserId matches adminId
    const communityGroupAdmin = await communityGroupModel.find({ adminUserId: adminId, _id: groupId });

    if (communityGroupAdmin.length === 0) {
      throw new Error('You are not admin');
    }

    // Proceed with removing the user
    const updatedCommunity = await communityGroupService.leaveCommunityGroup(userId as string, groupId as string);

    res.status(200).json({
      success: true,
      message: 'Successfully left the community group',
      data: updatedCommunity,
    });
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
