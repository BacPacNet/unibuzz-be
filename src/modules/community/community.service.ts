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

export const getUserCommunities = async (userID: string) => {
  try {
    const user = await User.findById(userID).lean();
    if (!user) throw new Error('User not found');

    const getCommunityIds = (communities: { communityId: string }[]) =>
      communities.map((c) => new mongoose.Types.ObjectId(c.communityId));

    const verifiedCommunityIds = getCommunityIds(user.userVerifiedCommunities);
    const unverifiedCommunityIds = getCommunityIds(user.userUnVerifiedCommunities);
    const allCommunityIds = [...verifiedCommunityIds, ...unverifiedCommunityIds];

    const communities = await communityModel.aggregate([
      {
        $match: { _id: { $in: allCommunityIds } },
      },
      {
        $lookup: {
          from: 'communitygroups',
          localField: '_id',
          foreignField: 'communityId',
          as: 'communityGroups',
        },
      },
    ]);

    return communities;
  } catch (error) {
    console.error('Error fetching user communities:', error);
    throw error;
  }
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
