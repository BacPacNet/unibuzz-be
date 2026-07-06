import mongoose from 'mongoose';
import httpStatus from 'http-status';
import universityModal from './university.model';
import {
  HighlightPost,
  HighlightPostPositionUpdate,
  ISemesterStart,
  IUniversityProfileUpdate,
  IUniversityProfileUpdateData,
  UniversityFilter,
} from './university.interface';
import { buildNameMatchRankingStages, buildSearchTermOrFilter, escapeRegex } from './university.pipeline';
import communityModel from '../community/community.model';
import communityGroupModel from '../communityGroup/communityGroup.model';
import { partneredUniService } from '../partneredUni';
import { ApiError } from '../errors';
import { communityPostsModel } from '../communityPosts';
import { userPostModel } from '../userPost';
import { convertToObjectId } from '../../utils/common';



export const getUniversityByName = async (university_name: string) => {
  const university = await universityModal.findOne({ name: university_name });

  if (!university) {
    return university;
  }

  const isAllowedToJoin = await partneredUniService.isPartneredUniversity(university._id);

  return {
    ...university.toObject(),
    isAllowedToJoin,
  };
};

export const getUniversityDashboardStats = async (university_name: string) => {
  const university = await universityModal.findOne({ name: university_name }).lean();

  if (!university?._id) {
    return null;
  }

  const community = await communityModel.findOne({ university_id: university._id }).select('_id').lean();

  const profileMatchOr: Record<string, unknown>[] = [];
  if (community?._id) {
    profileMatchOr.push({ 'communities.communityId': community._id });
    profileMatchOr.push({ 'email.communityId': community._id.toString() });
  }

  const [communityUserStats, profileUserStats] = await Promise.all([
    communityModel.aggregate([
      { $match: { university_id: university._id } },
      { $project: { users: { $ifNull: ['$users', []] } } },
      { $unwind: { path: '$users', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'users',
          localField: 'users.id',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: false } },
      { $match: { 'userDoc.isDeleted': { $ne: true } } },
      {
        $group: {
          _id: null,
          allUserIds: { $addToSet: '$users.id' },
          studentUserIds: {
            $addToSet: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$users.role', ''] } }, 'student'] },
                '$users.id',
                null,
              ],
            },
          },
          facultyUserIds: {
            $addToSet: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$users.role', ''] } }, 'faculty'] },
                '$users.id',
                null,
              ],
            },
          },
          applicantUserIds: {
            $addToSet: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$users.role', ''] } }, 'applicant'] },
                '$users.id',
                null,
              ],
            },
          },
        },
      },
    ]),
    mongoose.model('UserProfile').aggregate([
      {
        $match: profileMatchOr.length ? { $or: profileMatchOr } : { _id: { $exists: false } },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'users_id',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: false } },
      { $match: { 'userDoc.isDeleted': { $ne: true } } },
      {
        $group: {
          _id: null,
          allUserIds: { $addToSet: '$users_id' },
          studentUserIds: {
            $addToSet: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$role', ''] } }, 'student'] },
                '$users_id',
                null,
              ],
            },
          },
          facultyUserIds: {
            $addToSet: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$role', ''] } }, 'faculty'] },
                '$users_id',
                null,
              ],
            },
          },
          applicantUserIds: {
            $addToSet: {
              $cond: [
                { $eq: [{ $toLower: { $ifNull: ['$role', ''] } }, 'applicant'] },
                '$users_id',
                null,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const communityStats = communityUserStats[0] as
    | {
        allUserIds?: mongoose.Types.ObjectId[];
        studentUserIds?: mongoose.Types.ObjectId[];
        facultyUserIds?: mongoose.Types.ObjectId[];
        applicantUserIds?: mongoose.Types.ObjectId[];
      }
    | undefined;
  const profileStats = profileUserStats[0] as
    | {
        allUserIds?: mongoose.Types.ObjectId[];
        studentUserIds?: mongoose.Types.ObjectId[];
        facultyUserIds?: mongoose.Types.ObjectId[];
        applicantUserIds?: mongoose.Types.ObjectId[];
      }
    | undefined;

  const toIdSet = (ids?: mongoose.Types.ObjectId[]) =>
    new Set((ids || []).filter(Boolean).map((id) => id.toString()));

  const totalUserIds = new Set([
    ...toIdSet(communityStats?.allUserIds),
    ...toIdSet(profileStats?.allUserIds),
  ]);
  const totalStudentUserIds = new Set([
    ...toIdSet(communityStats?.studentUserIds),
    ...toIdSet(profileStats?.studentUserIds),
  ]);
  const totalFacultyUserIds = new Set([
    ...toIdSet(communityStats?.facultyUserIds),
    ...toIdSet(profileStats?.facultyUserIds),
  ]);
  const totalApplicantUserIds = new Set([
    ...toIdSet(communityStats?.applicantUserIds),
    ...toIdSet(profileStats?.applicantUserIds),
  ]);

  const [totalGroups, totalOfficialGroups, totalCasualGroups] = community?._id
    ? await Promise.all([
        communityGroupModel.countDocuments({ communityId: community._id }),
        communityGroupModel.countDocuments({ communityId: community._id, communityGroupType: 'official' }),
        communityGroupModel.countDocuments({ communityId: community._id, communityGroupType: 'casual' }),
      ])
    : [0, 0, 0];

  return {
    totalUsers: totalUserIds.size,
    totalStudentUsers: totalStudentUserIds.size,
    totalFacultyUsers: totalFacultyUserIds.size,
    totalApplicantsUsers: totalApplicantUserIds.size,
    totalGroups,
    totalOfficialGroups,
    totalCasualGroups,
    semesterStart: university.semesterStart || null,
  };
};

export const getUniversityByRealId = async (id: string) => {
  return await universityModal.findById(new mongoose.Types.ObjectId(id));
};

export const getUniversityByUniversityId = async (universityId: string) => {
  const university = await universityModal.findById(convertToObjectId(universityId));

  if (!university) {
    return university;
  }

  const isAllowedToJoin = await partneredUniService.isPartneredUniversity(university._id);

  return {
    ...university.toObject(),
    isAllowedToJoin,
  };
};

export const setSemesterStart = async (university_name: string, semesterStart: ISemesterStart) => {
  return universityModal
    .findOneAndUpdate({ name: university_name }, { $set: { semesterStart } }, { new: true })
    .lean();
};

export const updateUniversityProfile = async (universityId: string, payload: IUniversityProfileUpdate) => {
  const updateData: Partial<IUniversityProfileUpdateData> = {};

  if (payload.name !== undefined) {
    const trimmedName = payload.name.trim();
    if (!trimmedName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'University name cannot be empty');
    }
    updateData.name = trimmedName;
  }

  const description = payload.long_description ?? payload.description;
  if (description !== undefined) {
    updateData.long_description = description;
  }

  const shortOverview = payload.short_overview ?? payload.shortOverview;
  if (shortOverview !== undefined) {
    updateData.short_overview = shortOverview;
  }

  if (payload.logo !== undefined) {
    updateData.logo = payload.logo;
  }

  if (payload.campus !== undefined) {
    updateData.campus = payload.campus;
  }

  const contacts = payload.contacts ?? {};

  if (payload.email !== undefined || contacts.email !== undefined) {
    updateData.email = payload.email ?? contacts.email ?? '';
  }

  if (payload.phone !== undefined || contacts.phone !== undefined) {
    updateData.phone = payload.phone ?? contacts.phone ?? '';
  }

  if (payload.address !== undefined || contacts.address !== undefined) {
    updateData.address = payload.address ?? contacts.address ?? '';
  }

  if (payload.office_hours !== undefined || contacts.office_hours !== undefined) {
    updateData.office_hours = payload.office_hours ?? contacts.office_hours ?? '';
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'At least one valid university field is required for update');
  }

  return universityModal
    .findByIdAndUpdate(convertToObjectId(universityId), { $set: updateData }, { new: true })
    .lean();
};

type HighlightPostInput = {
  postId: string;
  postType: HighlightPost['postType'];
  position: number;
};

const verifyHighlightPostExists = async (postId: string, postType: HighlightPost['postType']) => {
  const objectId = convertToObjectId(postId);
  if (postType === 'CommunityPost') {
    return communityPostsModel.exists({ _id: objectId });
  }
  return userPostModel.exists({ _id: objectId });
};

export const addUniversityHighlightPost = async (universityId: string, highlight: HighlightPostInput) => {
  const universityObjectId = convertToObjectId(universityId);
  const postObjectId = convertToObjectId(highlight.postId);

  const university = await universityModal.findById(universityObjectId).select('highlightPosts').lean();
  if (!university) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  const postExists = await verifyHighlightPostExists(highlight.postId, highlight.postType);
  if (!postExists) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');
  }

  const alreadyExists = (university.highlightPosts || []).some(
    (item) => item.postId.toString() === postObjectId.toString()
  );
  if (alreadyExists) {
    throw new ApiError(httpStatus.CONFLICT, 'Post is already a highlight');
  }

  const updatedUniversity = await universityModal
    .findByIdAndUpdate(
      universityObjectId,
      {
        $push: {
          highlightPosts: {
            postId: postObjectId,
            postType: highlight.postType,
            position: highlight.position,
          },
        },
      },
      { new: true }
    )
    .lean();

  if (!updatedUniversity) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  return updatedUniversity;
};

export const deleteUniversityHighlightPost = async (universityId: string, postId: string) => {
  const universityObjectId = convertToObjectId(universityId);
  const postObjectId = convertToObjectId(postId);

  const university = await universityModal.findById(universityObjectId).select('highlightPosts').lean();
  if (!university) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  const highlightExists = (university.highlightPosts || []).some(
    (item) => item.postId.toString() === postObjectId.toString()
  );
  if (!highlightExists) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Highlight post not found');
  }

  const updatedUniversity = await universityModal
    .findByIdAndUpdate(
      universityObjectId,
      {
        $pull: {
          highlightPosts: { postId: postObjectId },
        },
      },
      { new: true }
    )
    .lean();

  if (!updatedUniversity) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  return updatedUniversity;
};

export const updateUniversityHighlightPostPositions = async (
  universityId: string,
  highlights: HighlightPostPositionUpdate[]
) => {
  const universityObjectId = convertToObjectId(universityId);
  const university = await universityModal.findById(universityObjectId).select('highlightPosts').lean();

  if (!university) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  const existingHighlights = university.highlightPosts || [];
  if (existingHighlights.length !== highlights.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'All highlight posts must be provided');
  }

  const seenPostIds = new Set<string>();
  const seenPositions = new Set<number>();

  for (const highlight of highlights) {
    const normalizedPostId = convertToObjectId(highlight.postId).toString();

    if (seenPostIds.has(normalizedPostId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Duplicate postId found in highlight positions');
    }
    seenPostIds.add(normalizedPostId);

    if (seenPositions.has(highlight.position)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Duplicate position found in highlight positions');
    }
    seenPositions.add(highlight.position);
  }

  const existingHighlightMap = new Map(
    existingHighlights.map((item) => [item.postId.toString(), item.postType])
  );

  for (const highlight of highlights) {
    const normalizedPostId = convertToObjectId(highlight.postId).toString();
    const existingPostType = existingHighlightMap.get(normalizedPostId);

    if (!existingPostType) {
      throw new ApiError(httpStatus.NOT_FOUND, `Highlight post not found for postId ${highlight.postId}`);
    }

    if (existingPostType !== highlight.postType) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Invalid postType for postId ${highlight.postId}`);
    }
  }

  const updatedHighlights = highlights
    .map((highlight) => ({
      postId: convertToObjectId(highlight.postId),
      postType: highlight.postType,
      position: highlight.position,
    }))
    .sort((a, b) => a.position - b.position);

  const updatedUniversity = await universityModal
    .findByIdAndUpdate(
      universityObjectId,
      {
        $set: {
          highlightPosts: updatedHighlights,
        },
      },
      { new: true }
    )
    .lean();

  if (!updatedUniversity) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  return updatedUniversity;
};




export const getAllUniversity = async (
  page: number = 1,
  limit: number = 10,
  name: string = '',
  city: string = '',
  country: string = '',
  region: string = '',
  type: string = ''
) => {
  const startIndex = (page - 1) * limit;
  const normalizedName = name.trim();

  const searchConditions: UniversityFilter[] = [];

  if (city) {
    searchConditions.push({ city: { $regex: escapeRegex(city), $options: 'i' } });
  }
  if (country) {
    searchConditions.push({ country: { $regex: escapeRegex(country), $options: 'i' } });
  }
  if (region) {
    searchConditions.push({ continent: { $regex: escapeRegex(region), $options: 'i' } });
  }
  if (type) {
    searchConditions.push({ type: { $regex: escapeRegex(type), $options: 'i' } });
  }
  if (normalizedName) {
    searchConditions.push({
      name: { $regex: escapeRegex(normalizedName), $options: 'i' },
    });
  }

  const matchStage = searchConditions.length > 0 ? { $match: { $and: searchConditions } } : { $match: {} };

  const aggregation: mongoose.PipelineStage[] = [matchStage];

  if (normalizedName) {
    aggregation.push(...buildNameMatchRankingStages(normalizedName));
  }

  aggregation.push({ $skip: startIndex }, { $limit: limit });

  const Universities = await universityModal.aggregate(aggregation).option({ allowDiskUse: true });

  const totalUniversities = await universityModal.countDocuments(matchStage.$match);
  const totalPages = Math.ceil(totalUniversities / limit);

  return {
    Universities,
    currentPage: page,
    totalPages,
    totalUniversities,
  };
};

export const getPartneredUniversities = async () => {
  const partneredUniversityIds = await partneredUniService.getPartneredUniversityIds();
  const partneredUniversities =
    partneredUniversityIds.length > 0
      ? await universityModal.find({ _id: { $in: partneredUniversityIds } }).lean()
      : [];
  return partneredUniversities;
};



export const searchUniversityByQuery = async (
  searchTerm: string,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;
  const normalizedSearchTerm = searchTerm.trim();

  const aggregation: mongoose.PipelineStage[] = [];

  if (normalizedSearchTerm) {
    aggregation.push({
      $match: buildSearchTermOrFilter(normalizedSearchTerm),
    });

    aggregation.push(...buildNameMatchRankingStages(normalizedSearchTerm));
  } else {
    aggregation.push({ $match: {} });
  }

  aggregation.push({ $skip: skip }, { $limit: limit });

  const universities = await universityModal
    .aggregate(aggregation)
    .option({ allowDiskUse: true });

  const totalCount = await universityModal.countDocuments(
    normalizedSearchTerm
      ? buildSearchTermOrFilter(normalizedSearchTerm)
      : {}
  );

  return {
    universities,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
    totalResults: totalCount,
  };
};
