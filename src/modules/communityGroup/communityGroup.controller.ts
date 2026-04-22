import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { communityGroupModel, communityGroupService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { ChangeStatusBody, communityGroupInterface, CommunityGroupNotificationPayload, CommunityGroupWithNotification, status, UpdateJoinRequestBody } from './communityGroup.interface';
import { CreateNotificationPayload, notificationRoleAccess, notificationStatus } from '../Notification/notification.interface';
import { notificationService } from '../Notification';

import { communityService } from '../community';
import { io } from '../../index';
import { convertToObjectId } from '../../utils/common';
import { sendPushNotification } from '../pushNotification/pushNotification.service';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import catchAsync from '../utils/catchAsync';
import { userIdExtend } from '../../config/userIDType';

const RESPONSE_MESSAGE = {
  STATUS_UPDATED: 'Status Updated Successfully',
  CREATED_GROUP: 'Successfully created the community group',
  UPDATED_GROUP: 'Updated Successfully',
  LEFT_GROUP: 'Successfully left the community group',
} as const;

const NOTIFICATION_MESSAGE = {
  REQUEST_REJECTED: 'Your Request has been Rejected',
  REQUEST_ACCEPTED: 'Your Request has been Accepted',
} as const;

const PUSH_APP_NAME = 'Unibuzz';



function parseGroupIdOrThrow(groupId: unknown): mongoose.Types.ObjectId {
  if (typeof groupId !== 'string' || !mongoose.Types.ObjectId.isValid(groupId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID');
  }
  return new mongoose.Types.ObjectId(groupId);
}

function toAdminUserIdString(
  admin: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId } | string
): string {
  if (typeof admin === 'string') return admin;
  return '_id' in admin && admin._id != null ? admin._id.toString() : (admin as mongoose.Types.ObjectId).toString();
}



async function createNotificationEmitAndPush(
  recipientId: string,
  notificationPayload: CommunityGroupNotificationPayload,
  pushPayloadOverrides?: Record<string, string | undefined>
): Promise<void> {
  await notificationService.createNotification(notificationPayload as unknown as CreateNotificationPayload);
  io.emit(`notification_${recipientId}`, { type: notificationPayload.type });
  const senderStr =
    typeof notificationPayload.sender_id === 'string'
      ? notificationPayload.sender_id
      : notificationPayload.sender_id?.toString();
  const receiverStr =
    typeof notificationPayload.receiverId === 'string'
      ? notificationPayload.receiverId
      : notificationPayload.receiverId?.toString();
  const communityGroupIdStr =
    notificationPayload.communityGroupId != null
      ? typeof notificationPayload.communityGroupId === 'string'
        ? notificationPayload.communityGroupId
        : notificationPayload.communityGroupId.toString()
      : undefined;
  sendPushNotification(recipientId, PUSH_APP_NAME, notificationPayload.message, {
    sender_id: senderStr,
    receiverId: receiverStr,
    communityGroupId: communityGroupIdStr,
    type: notificationPayload.type,
    ...pushPayloadOverrides,
  });
}

export const CreateCommunityGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const userId = req.userId;
  const { communityId } = req.params;
  const { body } = req;
  const isOfficial = body.communityGroupType.toLowerCase() === 'official';

  if (!communityId || !userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Community ID is required');
  }
  const community = await communityService.getCommunity(communityId);
  if (!community) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
  }

  let isAdminOfCommunity: boolean = false;
  if (community?.adminId) {
    isAdminOfCommunity = community?.adminId?.map(String).includes(userId?.toString());
  }

  // check community id as we are not allowed to create group with same name in same community also find if not case sensitive
  const existingGroupWithSameTitle = await communityGroupModel.findOne({
    communityId: communityId,
    title: { $regex: new RegExp(`^${body.title}$`, 'i') },
  });
  if (existingGroupWithSameTitle) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Community group with same name already exists');
  }

  const createdGroup = await communityGroupService.createCommunityGroup(
    body,
    communityId,
    userId,
    isOfficial,
    isAdminOfCommunity
  );

  if (isOfficial && !community?.adminId?.map(String).includes(userId?.toString() || '')) {
    const officialRequestMessage = `${body?.title} in ${community?.name} has requested an official group status`;
    for (const adminId of community?.adminId || []) {
      await createNotificationEmitAndPush(
        adminId.toString(),
        {
          sender_id: convertToObjectId(userId.toString()),
          receiverId: convertToObjectId(adminId.toString()),
          communityGroupId: convertToObjectId(createdGroup._id.toString()),
          type: notificationRoleAccess.OFFICIAL_GROUP_REQUEST,
          message: officialRequestMessage,
        },
        { communityGroupId: createdGroup._id.toString(), communityId }
      );
    }
  }

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGE.CREATED_GROUP,
    data: createdGroup,
  });
});

export const createCommunityGroupBySuperAdmin = catchAsync(async (req: userIdExtend, res: Response) => {
  const userId = req.userId;
  const { communityId } = req.params;
  const payloads = Array.isArray(req.body) ? req.body : [req.body];
  const settledResults = await Promise.allSettled(
    payloads.map((body) => communityGroupService.createCommunityGroupBySuperAdmin(body, communityId || '', userId || ''))
  );

  const passed: Array<{ index: number; title: string | undefined; data: unknown }> = [];
  const failed: Array<{ index: number; title: string | undefined; reason: string; statusCode: number }> = [];

  settledResults.forEach((result, index) => {
    const inputBody = payloads[index] as { title?: string } | undefined;
    const title = typeof inputBody?.title === 'string' ? inputBody.title : undefined;

    if (result.status === 'fulfilled') {
      passed.push({
        index,
        title,
        data: result.value,
      });
      return;
    }

    const error = result.reason as Partial<ApiError> & { message?: string };
    failed.push({
      index,
      title,
      reason: error?.message || 'Failed to create community group',
      statusCode: typeof error?.statusCode === 'number' ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  const hasFailures = failed.length > 0;

  res.status(200).json({
    success: !hasFailures,
    partialSuccess: hasFailures && passed.length > 0,
    message: hasFailures ? 'Community group bulk create completed with partial failures' : RESPONSE_MESSAGE.CREATED_GROUP,
    summary: {
      total: payloads.length,
      passed: passed.length,
      failed: failed.length,
    },
    data: {
      passed,
      failed,
    },
  });
});

export const updateCommunityGroup = catchAsync(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const validGroupId = parseGroupIdOrThrow(groupId);
  await communityGroupService.updateCommunityGroup(validGroupId, req.body);
  res.status(200).json({ message: RESPONSE_MESSAGE.UPDATED_GROUP });
});

export const updateCommunityGroupJoinRequest = catchAsync(async (req: userIdExtend, res: Response) => {
  const { groupId } = req.params as { groupId: string };
  const { notificationId, status: reqStatus, userId, adminId, communityGroupId } = req.body as UpdateJoinRequestBody;

  if (!groupId || !userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID or user ID');
  }
  if (reqStatus === status.rejected) {
    await communityGroupService.rejectCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
    await notificationService.changeNotificationStatus(notificationStatus.rejected, notificationId);
    await queueSQSNotification({
      sender_id: adminId,
      receiverId: userId,
      communityGroupId: communityGroupId,
      type: notificationRoleAccess.REJECTED_PRIVATE_GROUP_REQUEST,
      message: NOTIFICATION_MESSAGE.REQUEST_REJECTED,
    });
  }
  if (reqStatus === status.accepted) {
    await communityGroupService.acceptCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
    await notificationService.changeNotificationStatus(notificationStatus.accepted, notificationId);
    await queueSQSNotification({
      sender_id: adminId,
      receiverId: userId,
      communityGroupId: communityGroupId,
      type: notificationRoleAccess.ACCEPTED_PRIVATE_GROUP_REQUEST,
      message: NOTIFICATION_MESSAGE.REQUEST_ACCEPTED,
    });
  }
  res.status(200).json({ message: RESPONSE_MESSAGE.STATUS_UPDATED });
});
export const changeCommunityGroupStatus = catchAsync(async (req: userIdExtend, res: Response) => {
  const { groupId } = req.params as { groupId: string };
  const body = req.body as ChangeStatusBody;
  const { communityGroupId, adminId, userId, text } = body;

  parseGroupIdOrThrow(groupId);

  const communityGroup = (await communityGroupModel
    .findById(groupId)
    .populate({
      path: 'communityId',
      select: 'communityLogoUrl adminId name',
    })
    .lean()) as Document &
    communityGroupInterface & {
      communityId: { communityLogoUrl: string; adminId: string[]; name: string };
    };
  const communityAdminIds = communityGroup?.communityId?.adminId?.map(String);

  if (body.status === status.rejected) {
    await notificationService.changeNotificationStatusForCommunityAdmin(
      notificationStatus.rejected,
      body.notificationId!,
      communityAdminIds
    );

    await createNotificationEmitAndPush(
      userId.toString(),
      {
        sender_id: convertToObjectId(adminId.toString()),
        receiverId: convertToObjectId(userId.toString()),
        communityGroupId: convertToObjectId(communityGroupId.toString()),
        type: notificationRoleAccess.REJECTED_OFFICIAL_GROUP_REQUEST,
        message: text,
      }
    );

    if (communityAdminIds.length > 1) {
      for (const adminId of communityAdminIds) {
        if (adminId.toString() !== userId.toString()) {
          io.emit(`notification_${adminId}`, { type: notificationRoleAccess.REFETCHNOTIFICATIONS });
        }
      }
    }

    await communityGroupService.rejectCommunityGroupApproval(convertToObjectId(communityGroupId.toString()));
  }
  if (body.status === status.accepted) {
    const acceptedCommunityGroup = await communityGroupService.acceptCommunityGroupApproval(
      new mongoose.Types.ObjectId(groupId),
      communityAdminIds
    );
    await notificationService.changeNotificationStatusForCommunityAdmin(
      notificationStatus.accepted,
      body.notificationId!,
      communityAdminIds
    );

    await createNotificationEmitAndPush(
      userId.toString(),
      {
        sender_id: convertToObjectId(adminId.toString()),
        receiverId: convertToObjectId(userId.toString()),
        communityGroupId: convertToObjectId(communityGroupId.toString()),
        type: notificationRoleAccess.ACCEPTED_OFFICIAL_GROUP_REQUEST,
        message: text,
      },
      {
        communityGroupId: acceptedCommunityGroup?._id.toString(),
        communityId: acceptedCommunityGroup?.communityId.toString(),
      }
    );

    if (communityAdminIds.length > 1) {
      for (const adminId of communityAdminIds) {
        if (adminId.toString() !== userId.toString()) {
          io.emit(`notification_${adminId}`, { type: notificationRoleAccess.REFETCHNOTIFICATIONS });
        }
      }
    }
  }
  res.status(200).json({ message: RESPONSE_MESSAGE.STATUS_UPDATED });
});

export const deleteCommunityGroup = catchAsync(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const deleteCommunityGroup = await communityGroupService.deleteCommunityGroup(new mongoose.Types.ObjectId(groupId));
  res.status(200).json(deleteCommunityGroup);
});

export const getCommunityGroupById = catchAsync(async (req: userIdExtend, res: Response) => {
  const { communityGroupId } = req.query as { communityGroupId: string };
  const userId = req.userId?.toString() || '';

  const communityGroup = (await communityGroupService.getCommunityGroupById(communityGroupId, userId)) as CommunityGroupWithNotification;

  if (!communityGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
  }

  const adminUserId = toAdminUserIdString(communityGroup.adminUserId);

  const findNotificationByCommunityGroupId = await notificationService.findNotificationByCommunityGroupId(
    communityGroupId,
    userId?.toString() || '',
    adminUserId
  );
  if (findNotificationByCommunityGroupId?._id != null) {
    communityGroup.notificationId = findNotificationByCommunityGroupId._id;
  }
  if (findNotificationByCommunityGroupId?.type != null) {
    communityGroup.notificationTypes = findNotificationByCommunityGroupId.type;
  }
  if (findNotificationByCommunityGroupId?.status != null) {
    communityGroup.notificationStatus = findNotificationByCommunityGroupId.status;
  }

  if (adminUserId) {
    communityGroup.adminUserId = adminUserId;
  }

  res.status(httpStatus.OK).json(communityGroup);
});

export const joinCommunityGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId as string;
  const { groupId } = req.params;
  const updatedCommunity = await communityGroupService.joinCommunityGroup(userID, groupId as string);
  res.status(200).json(updatedCommunity);
});

export const acceptPrivateCommunityGroupRequest = catchAsync(async (req: userIdExtend, res: Response) => {
  const { groupId, userId } = req.params as { groupId: string; userId: string };
  const { notificationId, status: reqStatus } = req.body as { notificationId: string; status: string };
  if (!groupId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid group ID');
  }
  if (reqStatus === status.rejected) {
    await communityGroupService.rejectCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
    await notificationService.changeNotificationStatus(notificationStatus.rejected, notificationId);
  }
  if (reqStatus === status.accepted) {
    await communityGroupService.acceptCommunityGroupJoinApproval(new mongoose.Types.ObjectId(groupId), userId);
    await notificationService.changeNotificationStatus(notificationStatus.accepted, notificationId);
  }
  res.status(200).json({ message: RESPONSE_MESSAGE.STATUS_UPDATED });
});

export const leaveCommunityGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const userID = req.userId as string;
  const { groupId } = req.params;
  const updatedCommunity = await communityGroupService.leaveCommunityGroup(userID, groupId as string);

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGE.LEFT_GROUP,
    data: updatedCommunity,
  });
});

export const removeUserFromCommunityGroup = catchAsync(async (req: userIdExtend, res: Response) => {
  const adminId = req.userId as string;
  const { groupId, userId } = req.params;

  const communityGroupAdmin = await communityGroupModel.find({ adminUserId: adminId, _id: groupId });

  if (communityGroupAdmin.length === 0) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not admin');
  }

  await communityGroupService.leaveCommunityGroup(userId as string, groupId as string);

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGE.LEFT_GROUP,
 
  });
});

export const getCommunityGroupMembers = catchAsync(async (req: userIdExtend, res: Response) => {
  const { communityGroupId, userStatus, page, limit } = req.query;
  const userId = req.userId as string;
  const communityGroup = await communityGroupService.getCommunityGroupMembers(
    communityGroupId as string,
    userStatus as string,
    Number(page),
    Number(limit),
    userId
  );
  res.status(httpStatus.OK).json(communityGroup);
});

export const getCommunityGroupMembersForSuperAdmin = catchAsync(async (req: userIdExtend, res: Response) => {
  const { communityGroupId, userStatus, page, limit } = req.query;
  const communityGroup = await communityGroupService.getCommunityGroupMembersForSuperAdmin(
    communityGroupId as string,
    userStatus as string,
    Number(page),
    Number(limit)
  );
  res.status(httpStatus.OK).json(communityGroup);
});
