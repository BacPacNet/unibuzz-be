import httpStatus from 'http-status';
import { ApiError } from '../errors';
import communityModel from './community.model';
import { User } from '../user';
import { userProfileService } from '../userProfile';
import mongoose, { PipelineStage } from 'mongoose';
import { getUserById } from '../user/user.service';
import { communityService } from '.';
import UniversityModel, { IUniversity } from '../university/university.model';

export const createCommunity = async (
  name: string,
  adminId: string,
  university_id: string,
  numberOfStudent: string,
  numberOfFaculty: string,
  coverImg: string,
  logo: string,
  about: string
) => {
  const data = {
    name,
    adminId,
    university_id,
    numberOfStudent: numberOfStudent || 0,
    numberOfFaculty: numberOfFaculty || 0,
    numberOfUser: 0,
    communityCoverUrl: { imageUrl: coverImg },
    communityLogoUrl: { imageUrl: logo },
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

    const getAllUserCommunityIds = userProfile.communities;

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
      {
        $addFields: {
          communityGroups: {
            $cond: {
              if: {
                $in: [new mongoose.Types.ObjectId(userID), '$users.id'],
              },
              then: '$communityGroups',
              else: [],
            },
          },
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
  sortBy: string,
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

    switch (sortBy) {
      case 'name':
        pipeline.push({
          $addFields: {
            communityGroups: {
              $map: {
                input: '$communityGroups',
                as: 'group',
                in: {
                  $mergeObjects: ['$$group', { lowerTitle: { $toLower: '$$group.title' } }],
                },
              },
            },
          },
        });

        pipeline.push({
          $addFields: {
            communityGroups: {
              $sortArray: { input: '$communityGroups', sortBy: { lowerTitle: 1 } },
            },
          },
        });

        pipeline.push({
          $unset: 'communityGroups.lowerTitle',
        });
        break;

      case 'users':
        pipeline.push({
          $addFields: {
            communityGroups: {
              $map: {
                input: '$communityGroups',
                as: 'group',
                in: {
                  $mergeObjects: ['$$group', { userCount: { $size: '$$group.users' } }],
                },
              },
            },
          },
        });

        pipeline.push({
          $addFields: {
            communityGroups: {
              $sortArray: { input: '$communityGroups', sortBy: { userCount: -1 } },
            },
          },
        });

        pipeline.push({
          $unset: 'communityGroups.userCount',
        });
        break;

      case 'latest':
        pipeline.push({
          $addFields: {
            communityGroups: {
              $sortArray: { input: '$communityGroups', sortBy: { createdAt: -1 } },
            },
          },
        });
        break;

      default:
        break;
    }

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

export const joinCommunity = async (userId: mongoose.Types.ObjectId, communityId: string, isVerfied: boolean = false) => {
  const user = await getUserById(userId);
  const userProfile = await userProfileService.getUserProfileById(String(userId));

  if (!user || !userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const community = await communityModel.findOne({ _id: communityId, 'users.id': userId });

  if (community) {
    throw new ApiError(httpStatus.CONFLICT, 'User is already a member of this community');
  }

  if (!userProfile.communities.includes(communityId)) {
    userProfile.communities.push(communityId);
    await userProfile.save();
  }

  const userResult = await communityModel.findOne({
    _id: communityId,
    users: { $elemMatch: { id: userId } },
  });

  if (!userResult) {
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
            occupation: userProfile.occupation,
            affiliation: userProfile.affiliation,
            role: userProfile.role,
            isVerified: isVerfied,
          },
        },
      }
    );
    return updateUser;
  }
};

export const joinCommunityFromUniversity = async (universityId: string, userId: string, isVerfied: boolean = false) => {
  const fetchUniversity = await UniversityModel.findById(universityId);
  if (!fetchUniversity) {
    throw new Error('University not found');
  }
  try {
    let community = await communityModel.findOne({ university_id: universityId });
    if (!community) {
      const { _id: communityId, logo, campus, total_students, short_overview, name } = fetchUniversity as IUniversity;
      community = await communityModel.create({
        name: name,
        communityLogoUrl: { imageUrl: logo },
        communityCoverUrl: { imageUrl: campus },
        total_students: total_students,
        university_id: communityId,
        created_by: userId,
        about: short_overview,
      });
    }
    await communityService.joinCommunity(new mongoose.Types.ObjectId(userId), (community?._id).toString(), isVerfied);

    return { message: 'Joined Successfully', data: { community: community } };

    //res.status(httpStatus.OK).json({ message: 'Joined Successfully', data: { communityId: community?._id } });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const leaveCommunity = async (userId: mongoose.Types.ObjectId, communityId: string) => {
  try {
    const user = await getUserById(userId);
    const userProfile = await userProfileService.getUserProfileById(String(userId));
    if (!user || !userProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const community = await getCommunity(communityId);
    if (!community) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Community not found');
    }

    const communityIndex = userProfile.communities.findIndex((id) => id.toString() === communityId.toString());
    userProfile.communities.splice(communityIndex, 1);
    await userProfile.save();

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
