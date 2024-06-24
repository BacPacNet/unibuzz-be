// import { communityInterface } from "./community.interface";
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import communityModel from './community.model';

export const createCommunity = async (community: any) => {
  const updatedCommunity = { ...community._doc, adminId: '6634c0e646b1f2b7eee2c66a' };
  // console.log(updatedCommunity);
  return await communityModel.create(updatedCommunity);
};

export const getCommunity = async (communityId: string) => {
  return await communityModel.findById(communityId);
};

export const updateCommunity = async (id: string, community: any) => {
  let communityToUpadate;

  communityToUpadate = await communityModel.findById(id);

  if (!communityToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }
  Object.assign(communityToUpadate, community);
  await communityToUpadate.save();
  return communityToUpadate;
};
