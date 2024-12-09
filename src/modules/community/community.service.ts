import httpStatus from 'http-status';
import { ApiError } from '../errors';
import communityModel from './community.model';
import { User } from '../user';
import { userProfileService } from '../userProfile';
import mongoose, { PipelineStage } from 'mongoose';
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

export const getUserFilteredCommunities = async (
  userID: string,
  communityId: string = '',
  filters?: {
    selectedType?: string[];
    selectedFilters?: Record<string, string[]>;
  }
): Promise<any[]> => {
  try {
    const user = await User.findById(userID).lean();
    if (!user) throw new Error('User not found');

    const userProfile = await userProfileService.getUserProfileById(userID);
    if (!userProfile) throw new Error('User Profile not found');

    const pipeline: PipelineStage[] = [
      {
        $match: { _id: new mongoose.Types.ObjectId(communityId) },
      },
      {
        $lookup: {
          from: 'communitygroups',
          localField: '_id',
          foreignField: 'communityId',
          as: 'communityGroups',
        },
      },
    ];

    if (filters) {
      const { selectedType, selectedFilters } = filters;

      if (selectedType?.length) {
        const typeConditions: any[] = [];
        if (selectedType.includes('Private')) typeConditions.push({ $eq: ['$$group.communityGroupAccess', 'Private'] });
        if (selectedType.includes('Public')) typeConditions.push({ $eq: ['$$group.communityGroupAccess', 'Public'] });
        if (selectedType.includes('Official')) typeConditions.push({ $eq: ['$$group.communityGroupType', 'Official'] });
        if (selectedType.includes('Casual')) typeConditions.push({ $eq: ['$$group.communityGroupType', 'Casual'] });

        pipeline.push({
          $addFields: {
            communityGroups: {
              $filter: {
                input: '$communityGroups',
                as: 'group',
                cond: {
                  $or: typeConditions,
                },
              },
            },
          },
        });
      }

      if (selectedFilters && Object.keys(selectedFilters).length) {
        pipeline.push({
          $addFields: {
            communityGroups: {
              $filter: {
                input: '$communityGroups',
                as: 'group',
                cond: {
                  $anyElementTrue: {
                    $map: {
                      input: {
                        $ifNull: [
                          {
                            $filter: {
                              input: { $objectToArray: '$$group.communityGroupCategory' },
                              as: 'category',
                              cond: {
                                $or: Object.entries(selectedFilters).map(([key, subcategories]) => ({
                                  $and: [
                                    { $eq: ['$$category.k', key] },
                                    {
                                      $anyElementTrue: {
                                        $map: {
                                          input: subcategories,
                                          as: 'sub',
                                          in: { $in: ['$$sub', '$$category.v'] },
                                        },
                                      },
                                    },
                                  ],
                                })),
                              },
                            },
                          },
                          [],
                        ],
                      },
                      as: 'matchedCategory',
                      in: { $ne: ['$$matchedCategory', null] },
                    },
                  },
                },
              },
            },
          },
        });
      }

      pipeline.push({
        $match: { 'communityGroups.0': { $exists: true } },
      });
    }

    pipeline.push({ $project: { communityGroups: 1 } });

    const communities = await communityModel.aggregate(pipeline);
    return communities.length ? communities[0] : { _id: communityId, communityGroups: [] };
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

export const joinCommunity = async (userId: mongoose.Types.ObjectId, communityId: string) => {
  const user = await getUserById(userId);
  const userProfile = await userProfileService.getUserProfileById(String(userId));

  if (!user || !userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const community = await communityModel.findOne({ _id: communityId, 'users.id': userId });

  if (community) {
    throw new ApiError(httpStatus.CONFLICT, 'User is already a member of this community');
  }

  const communityIds = userProfile?.email.map((emailItem) => emailItem.communityId);

  const userSet = new Set(communityIds);

  if (!userSet.has(communityId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not verified to join this community');
  }

  const updateUser = await communityModel.updateOne(
    { _id: communityId },
    {
      $push: {
        users: {
          id: userId,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: userProfile.profile_dp?.imageUrl || null,
          universityName: userProfile.university_name,
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
