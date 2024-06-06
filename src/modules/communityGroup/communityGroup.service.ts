import mongoose from 'mongoose';
import communityGroupModel from './communityGroup.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const createCommunityGroup = async (userID: string, communityId: string, body: any) => {
  const newComment = { ...body, communityId: communityId, adminUserId: userID };
  return await communityGroupModel.create(newComment);
};

export const updateCommunityGroup = async (id: mongoose.Types.ObjectId, body: any) => {
  let communityGroupToUpadate;
  communityGroupToUpadate = await communityGroupModel.findById(id);

  if (!communityGroupToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'comment not found!');
  }
  Object.assign(communityGroupToUpadate, body);
  await communityGroupToUpadate.save();
  return communityGroupToUpadate;
};

export const deleteCommunityGroup = async (id: mongoose.Types.ObjectId) => {
  return await communityGroupModel.findByIdAndDelete(id);
};

export const getAllCommunityGroup = async (communityId: string) => {
  return await communityGroupModel.find({ communityId });
};
