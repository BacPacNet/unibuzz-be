import httpStatus from 'http-status';
import { ApiError } from '../errors';
import communityModel from './community.model';
import { User } from '../user';
import { userProfileService } from '../userProfile';
import mongoose from 'mongoose';
import { getUserById } from '../user/user.service';

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

    const userProfile = await userProfileService.getUserProfileById(userID);
    if (!userProfile) throw new Error('User Profile not found');

    const getAllUserCommunityIds = userProfile.email
      .map((emailItem) => new mongoose.Types.ObjectId(emailItem?.communityId))
      .filter(Boolean);

    const communities = await communityModel.aggregate([
      {
        $match: { _id: { $in: getAllUserCommunityIds } },
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

export const joinCommunity = async (userId: mongoose.Types.ObjectId, communityId: string) => {
  const user = await getUserById(userId);
  const userProfile = await userProfileService.getUserProfileById(String(userId));
  if (!user || !userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const checkIfUserIsVerified = userProfile?.email.some((emailItem) => emailItem.communityId);

  if (!checkIfUserIsVerified) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is already a member of this community');
  }

  const updateUser = await communityModel.updateOne(
    { _id: communityId },
    {
      $push: {
        users: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
          year: userProfile.study_year,
          degree: userProfile.degree,
          major: userProfile.major,
        },
      },
    }
  );

  return updateUser;
};

export const leaveCommunity = async (userId: mongoose.Types.ObjectId, communityId: string) => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const community = await getCommunity(communityId);
    if (!community) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community group not found');
    }

    // Check if the user is a member of the communityGroup
    const userIndex = community.users.findIndex((user) => user.id.toString() === userId.toString());

    if (userIndex === -1) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not a member of this community');
    }

    // Remove the user from the community's users array
    community.users.splice(userIndex, 1);

    // Save the updated communityGroup
    return await community.save();
  } catch (error: any) {
    console.error(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'An error occurred');
  }
};
