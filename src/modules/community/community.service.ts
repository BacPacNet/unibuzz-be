import httpStatus from 'http-status';
import { ApiError } from '../errors';
import communityModel from './community.model';
import { User } from '../user';
import mongoose from 'mongoose';

export const createCommunity = async (
  name: string,
  adminId: string,
  collegeID: string,
  numberOfStudent: string,
  numberOfFaculty: string,
  coverImg: any,
  logo: any,
  about: string
) => {
  const coverImage = coverImg[0] ? coverImg[0] : '';
  const logoImage = logo[0] ? logo[0] : '';

  const data = {
    name,
    adminId,
    collegeID,
    numberOfStudent: numberOfStudent || 0,
    numberOfFaculty: numberOfFaculty || 0,
    numberOfUser: 0,
    communityCoverUrl: { imageUrl: coverImage },
    communityLogoUrl: { imageUrl: logoImage },
    about,
  };
  return await communityModel.create(data);
};

export const getCommunity = async (communityId: string) => {
  return await communityModel.findById(communityId);
};

export const getUserCommunitys = async (userID: string) => {
  const user: any = await User.findById(userID);
  const verifiedCommunityIds = user.userVerifiedCommunities.map((c: any) => new mongoose.Types.ObjectId(c.communityId));
  const unverifiedCommunityIds = user.userUnVerifiedCommunities.map((c: any) => new mongoose.Types.ObjectId(c.communityId));
  console.log(unverifiedCommunityIds, 'unverifiedCommunityIds');

  const allCommunityIds = [...verifiedCommunityIds, ...unverifiedCommunityIds];
  const communities = await communityModel
    .find({ _id: { $in: allCommunityIds } })
    .populate({ path: 'collegeID', select: 'wikiInfoBox.Address wikiInfoBox.Location collegeBoardInfo.Location' })
    .lean();

  return communities;
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

export const communityMemberToggle = async (communityId: string, isMember: boolean) => {
  const incrementValue = isMember ? 1 : -1;

  await communityModel.findOneAndUpdate({ _id: communityId }, { $inc: { numberOfUser: incrementValue } });
};
