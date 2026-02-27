import mongoose, { PipelineStage } from 'mongoose';
import { CommunityGroupAccess, CommunityGroupType } from '../../config/community.type';
import { status } from '../communityGroup/communityGroup.interface';

/** Filter options for getUserFilteredCommunities */
export type CommunityGroupFilters = {
  selectedType?: string[];
  selectedLabel?: string[];
  selectedFilters?: Record<string, string[]>;
};

export function buildFilteredCommunitiesBasePipeline(
  communityId: string,
  userObjectId: mongoose.Types.ObjectId,
  myBlockedUserIds: Set<string>
): PipelineStage[] {
  return [
    { $match: { _id: new mongoose.Types.ObjectId(communityId) } },
    {
      $lookup: {
        from: 'communitygroups',
        localField: '_id',
        foreignField: 'communityId',
        as: 'communityGroups',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'communityGroups.adminUserId',
        foreignField: '_id',
        as: 'groupAdmins',
      },
    },
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'communityGroups.adminUserId',
        foreignField: 'users_id',
        as: 'adminProfiles',
      },
    },
    {
      $addFields: {
        communityGroups: {
          $map: {
            input: '$communityGroups',
            as: 'group',
            in: {
              $mergeObjects: [
                '$$group',
                {
                  admin: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$groupAdmins',
                          as: 'a',
                          cond: { $eq: ['$$a._id', '$$group.adminUserId'] },
                        },
                      },
                      0,
                    ],
                  },
                  adminProfile: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$adminProfiles',
                          as: 'p',
                          cond: { $eq: ['$$p.users_id', '$$group.adminUserId'] },
                        },
                      },
                      0,
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      $addFields: {
        communityGroups: {
          $filter: {
            input: '$communityGroups',
            as: 'group',
            cond: {
              $and: [
                { $ne: ['$$group.admin.isDeleted', true] },
                {
                  $not: {
                    $in: [
                      '$$group.adminUserId',
                      Array.from(myBlockedUserIds).map((id) => new mongoose.Types.ObjectId(id)),
                    ],
                  },
                },
                {
                  $not: {
                    $anyElementTrue: {
                      $map: {
                        input: { $ifNull: ['$$group.adminProfile.blockedUsers', []] },
                        as: 'b',
                        in: { $eq: ['$$b.userId', userObjectId] },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  ];
}

export function buildGroupVisibilityFilterStage(
  userObjectId: mongoose.Types.ObjectId,
  hasFilters: boolean
): PipelineStage {
  const groupFilterConditions: any[] = [];
  if (!hasFilters) {
    groupFilterConditions.push({
      $eq: ['$$group.adminUserId', userObjectId],
    });
  }
  groupFilterConditions.push({
    $not: [
      {
        $and: [
          { $eq: ['$$group.communityGroupType', CommunityGroupType.CASUAL] },
          {
            $or: [
              { $eq: ['$$group.status', status.pending] },
              { $eq: ['$$group.status', status.rejected] },
            ],
          },
        ],
      },
    ],
  });
  return {
    $addFields: {
      communityGroups: {
        $filter: {
          input: '$communityGroups',
          as: 'group',
          cond: { $or: groupFilterConditions },
        },
      },
    },
  };
}

export function buildTypeAndLabelFilterStage(filters: CommunityGroupFilters): PipelineStage | null {
  const { selectedType, selectedLabel } = filters;
  if (!selectedType?.length && !selectedLabel?.length) return null;

  const filterConditions: any[] = [];

  if (selectedType?.length) {
    const accessConditions: any[] = [];
    const typeConditions: any[] = [];
    if (selectedType.includes(CommunityGroupAccess.Private)) {
      accessConditions.push({ $eq: ['$$group.communityGroupAccess', CommunityGroupAccess.Private] });
    }
    if (selectedType.includes(CommunityGroupAccess.Public)) {
      accessConditions.push({ $eq: ['$$group.communityGroupAccess', CommunityGroupAccess.Public] });
    }
    if (selectedType.includes('Official')) {
      typeConditions.push({ $eq: ['$$group.communityGroupType', CommunityGroupType.OFFICIAL] });
    }
    if (selectedType.includes('Casual')) {
      typeConditions.push({ $eq: ['$$group.communityGroupType', CommunityGroupType.CASUAL] });
    }
    if (accessConditions.length && typeConditions.length) {
      filterConditions.push({
        $or: [{ $and: accessConditions }, { $and: typeConditions }],
      });
    } else if (accessConditions.length) {
      filterConditions.push({ $or: accessConditions });
    } else if (typeConditions.length) {
      filterConditions.push({ $or: typeConditions });
    }
  }

  if (selectedLabel?.length) {
    const labelConditions = selectedLabel.map((label) => ({
      $eq: ['$$group.communityGroupLabel', label],
    }));
    filterConditions.push({ $or: labelConditions });
  }

  if (filterConditions.length === 0) return null;
  return {
    $addFields: {
      communityGroups: {
        $filter: {
          input: '$communityGroups',
          as: 'group',
          cond: { $and: filterConditions },
        },
      },
    },
  };
}

export function buildSelectedFiltersStage(selectedFilters: Record<string, string[]>): PipelineStage {
  return {
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
  };
}

export function buildCommunityGroupsSortStages(sortBy: string): PipelineStage[] {
  switch (sortBy) {
    case 'name':
    case 'alphabetAsc':
      return [
        {
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
        },
        {
          $addFields: {
            communityGroups: {
              $sortArray: {
                input: '$communityGroups',
                sortBy: { lowerTitle: 1 },
              },
            },
          },
        },
        { $unset: 'communityGroups.lowerTitle' as any },
      ];

    case 'alphabetDesc':
      return [
        {
          $addFields: {
            communityGroups: {
              $map: {
                input: '$communityGroups',
                as: 'group',
                in: {
                  $mergeObjects: [
                    '$$group',
                    {
                      lowerTitle: {
                        $cond: {
                          if: { $isArray: ['$$group.title'] },
                          then: '',
                          else: { $toLower: '$$group.title' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $addFields: {
            communityGroups: {
              $sortArray: {
                input: '$communityGroups',
                sortBy: { lowerTitle: -1 },
              },
            },
          },
        },
        { $unset: 'communityGroups.lowerTitle' as any },
      ];

    case 'users':
      return [
        {
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
        },
        {
          $addFields: {
            communityGroups: {
              $sortArray: {
                input: '$communityGroups',
                sortBy: { userCount: -1 },
              },
            },
          },
        },
        { $unset: 'communityGroups.userCount' as any },
      ];

    case 'userCountDesc':
    case 'userCountAsc':
      return [
        {
          $addFields: {
            communityGroups: {
              $map: {
                input: '$communityGroups',
                as: 'group',
                in: {
                  $mergeObjects: [
                    '$$group',
                    {
                      userCount: {
                        $size: {
                          $filter: {
                            input: '$$group.users',
                            as: 'user',
                            cond: { $eq: ['$$user.status', 'accepted'] },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $addFields: {
            communityGroups: {
              $sortArray: {
                input: '$communityGroups',
                sortBy: {
                  userCount: sortBy === 'userCountAsc' ? 1 : -1,
                },
              },
            },
          },
        },
        { $unset: 'communityGroups.userCount' as any },
      ];

    case 'latest':
      return [
        {
          $addFields: {
            communityGroups: {
              $sortArray: {
                input: '$communityGroups',
                sortBy: { createdAt: -1 },
              },
            },
          },
        },
      ];

    default:
      return [];
  }
}



export function buildCommunityGroupsProjectStage(userObjectId: mongoose.Types.ObjectId): PipelineStage[] {
  return [
    {
      $addFields: {
        communityGroups: {
          $map: {
            input: '$communityGroups',
            as: 'group',
            in: {
              $mergeObjects: [
                '$$group',
                {
                  users: {
                    $filter: {
                      input: { $ifNull: ['$$group.users', []] },
                      as: 'u',
                      cond: { $eq: ['$$u._id', userObjectId] },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      $project: {
        'communityGroups.adminProfile': 0,
        'communityGroups.admin': 0,
        'communityGroups.inviteUsers': 0,
      },
    },
  ];
}

/**
 * Builds the base pipeline for getting community users by filter
 */
export function buildCommunityUsersBasePipeline(communityId: string): PipelineStage[] {
  return [
    { $match: { _id: new mongoose.Types.ObjectId(communityId) } },
    { $unwind: '$users' },
  ];
}

/**
 * Builds a stage to exclude users that are already in a specific community group
 */
export function buildCommunityGroupUsersExclusionStage(
  communityGroupUserIds: mongoose.Types.ObjectId[]
): PipelineStage | null {
  if (!communityGroupUserIds?.length) return null;

  return {
    $match: {
      'users._id': { $nin: communityGroupUserIds },
    },
  };
}

/**
 * Builds a stage to filter only verified users
 */
export function buildVerifiedUsersFilterStage(isVerified: boolean): PipelineStage | null {
  if (!isVerified) return null;

  return {
    $match: { 'users.isVerified': true },
  };
}

/**
 * Builds stages to extract user fields and replace root
 */
export function buildUserFieldsExtractionStage(): PipelineStage[] {
  return [
    {
      $addFields: {
        users_id: '$users._id',
        isVerified: '$users.isVerified',
      },
    },
    {
      $replaceRoot: { newRoot: { users_id: '$users_id', isVerified: '$isVerified' } },
    },
  ];
}

/**
 * Builds stages to lookup user profiles
 */
export function buildUserProfileLookupStage(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'userprofiles',
        localField: 'users_id',
        foreignField: 'users_id',
        as: 'profile',
      },
    },
    { $unwind: '$profile' },
  ];
}

/**
 * Builds a stage to filter out blocked users (when pipeline docs have profile sub-document)
 */
export function buildBlockedUsersFilterStage(
  myBlockedUserIds: mongoose.Types.ObjectId[],
  currentUserObjectId: mongoose.Types.ObjectId
): PipelineStage {
  return {
    $match: {
      users_id: { $nin: myBlockedUserIds },
      'profile.blockedUsers': {
        $not: {
          $elemMatch: {
            userId: currentUserObjectId,
          },
        },
      },
    },
  };
}

/**
 * Builds a stage to filter out blocked users when pipeline root is UserProfile (blockedUsers at root)
 */
export function buildBlockedUsersFilterStageForProfileRoot(
  myBlockedUserIds: mongoose.Types.ObjectId[],
  currentUserObjectId: mongoose.Types.ObjectId
): PipelineStage {
  return {
    $match: {
      users_id: { $nin: myBlockedUserIds },
      blockedUsers: {
        $not: {
          $elemMatch: {
            userId: currentUserObjectId,
          },
        },
      },
    },
  };
}

/**
 * Builds stages to lookup users and filter deleted ones
 */
export function buildUserLookupAndFilterStage(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'users',
        localField: 'users_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: { 'user.isDeleted': { $ne: true } } },
  ];
}

/**
 * Builds a stage to add user fields (firstName, lastName, createdAt)
 */
export function buildUserFieldsAddStage(): PipelineStage {
  return {
    $addFields: {
      firstName: '$user.firstName',
      lastName: '$user.lastName',
      createdAt: '$user.createdAt',
    },
  };
}

/**
 * Builds a stage to filter users by search query
 */
export function buildSearchQueryFilterStage(searchQuery: string): PipelineStage | null {
  if (!searchQuery || searchQuery.trim() === '') return null;

  const terms = searchQuery.trim().split(/\s+/);
  const searchConditions = terms.map((term) => {
    const regex = new RegExp(term, 'i');
    return {
      $or: [{ firstName: { $regex: regex } }, { lastName: { $regex: regex } }],
    };
  });

  return {
    $match: { $and: searchConditions },
  };
}

/**
 * Builds a facet stage for pagination with data and total count
 */
export function buildPaginationFacetStage(page: number, limit: number): PipelineStage {
  const skip = (page - 1) * limit;

  return {
    $facet: {
      data: [
        { $skip: skip },
        { $limit: limit },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                '$profile',
                {
                  firstName: '$user.firstName',
                  lastName: '$user.lastName',
                  createdAt: '$user.createdAt',
                  isVerified: '$isVerified',
                },
              ],
            },
          },
        },
        {
          $project: {
            communities: 0,
            following: 0,
            followers: 0,
            email: 0,
            statusChangeHistory: 0,
          },
        },
      ],
      totalCount: [{ $count: 'total' }],
    },
  };
}

/**
 * Builds the base pipeline for getting user communities
 * Includes match by community IDs and lookup for community groups
 */
export function buildUserCommunitiesBasePipeline(communityIds: mongoose.Types.ObjectId[]): PipelineStage[] {
  return [
    {
      $match: { _id: { $in: communityIds } },
    },
    // {
    //   $lookup: {
    //     from: 'communitygroups',
    //     localField: '_id',
    //     foreignField: 'communityId',
    //     as: 'communityGroups',
    //   },
    // },
  ];
}

/**
 * Builds a stage to check if user is in the community
 */
export function buildUserInCommunityCheckStage(userObjectId: mongoose.Types.ObjectId): PipelineStage {
  return {
    $addFields: {
      // Determine if user is in this community
      isUserInCommunity: {
        $gt: [
          {
            $size: {
              $filter: {
                input: '$users',
                as: 'u',
                cond: { $eq: ['$$u._id', userObjectId] },
              },
            },
          },
          0,
        ],
      },
    },
  };
}

/**
 * Builds a stage to filter community groups based on user membership and visibility rules
 * If user is in community, shows groups where user is admin OR groups that are not CASUAL with pending/rejected status
 * If user is not in community, returns empty array
 */
export function buildUserCommunitiesGroupFilterStage(userObjectId: mongoose.Types.ObjectId): PipelineStage {
  return {
    // Filter communityGroups if user is not in the community
    $addFields: {
      communityGroups: {
        $cond: {
          if: '$isUserInCommunity',
          then: {
            $filter: {
              input: '$communityGroups',
              as: 'cg',
              cond: {
                $or: [
                  // Always show if adminUserId matches user
                  { $eq: ['$$cg.adminUserId', userObjectId] },
                  // Otherwise, keep if NOT (CASUAL + pending/rejected)
                  {
                    $not: [
                      {
                        $and: [
                          { $eq: ['$$cg.communityGroupType', CommunityGroupType.CASUAL] },
                          {
                            $or: [
                              { $eq: ['$$cg.status', status.pending] },
                              { $eq: ['$$cg.status', status.rejected] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          else: [],
        },
      },
    },
  };
}


// filter other users except the current user from the users array
export function buildUserCommunitiesUsersFilterStage(
  userObjectId?: mongoose.Types.ObjectId
): PipelineStage | null {

  if (!userObjectId) return null;

  return {
    $set: {
      users: {
        $cond: {
          if: { $in: [userObjectId, "$users._id"] },
          then: {
            $filter: {
              input: "$users",
              as: "u",
              cond: { $eq: ["$$u._id", userObjectId] }
            }
          },
          else: "$users"
        }
      }
    }
  };
}

/**
 * Builds a stage to remove helper fields from the pipeline result
 */
export function buildUserCommunitiesProjectStage(): PipelineStage {
  return {
    // Optionally remove helper field
    $project: {
      isUserInCommunity: 0,
    },
  };
}

/** Shared pipeline stages for getCommunityUsersService (data and count pipelines) */
export function buildCommunityUsersServiceBaseStages(
  userIds: mongoose.Types.ObjectId[]
): PipelineStage[] {
  return [
    { $match: { users_id: { $in: userIds } } },
    {
      $lookup: {
        from: 'users',
        localField: 'users_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        createdAt: '$user.createdAt',
      },
    },
  ];
}

/** Optional name search stage for getCommunityUsersService. Returns null if searchQuery is empty. */
export function buildCommunityUsersServiceSearchStage(searchQuery: string): PipelineStage | null {
  const trimmed = searchQuery?.trim();
  if (!trimmed) return null;
  const regex = new RegExp(trimmed, 'i');
  return {
    $match: {
      $or: [{ firstName: { $regex: regex } }, { lastName: { $regex: regex } }],
    },
  };
}
