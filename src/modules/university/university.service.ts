import mongoose from 'mongoose';
import universityModal from './university.model';
import { UniversityFilter } from './university.interface';
import { buildNameMatchRankingStages, buildSearchTermOrFilter, escapeRegex } from './university.pipeline';
import communityModel from '../community/community.model';
import communityGroupModel from '../communityGroup/communityGroup.model';



export const getUniversityById = async (university_name: string) => {
  return await universityModal.findOne({ name: university_name });
};

export const getUniversityDashboardStats = async (university_name: string) => {
  const university = await universityModal.findOne({ name: university_name }).lean();

  if (!university?._id) {
    return null;
  }

  const universityNameRegex = new RegExp(escapeRegex(university_name), 'i');

  const [community, communityUserStats, profileUserStats] = await Promise.all([
    communityModel.findOne({ university_id: university._id }).select('_id').lean(),
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
        },
      },
    ]),
    mongoose.model('UserProfile').aggregate([
      {
        $match: {
          $or: [
            { university_id: university._id },
            { university_name: { $regex: universityNameRegex } },
            { 'email.UniversityName': { $regex: universityNameRegex } },
          ],
        },
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
        },
      },
    ]),
  ]);

  const communityStats = communityUserStats[0] as
    | { allUserIds?: mongoose.Types.ObjectId[]; studentUserIds?: mongoose.Types.ObjectId[]; facultyUserIds?: mongoose.Types.ObjectId[] }
    | undefined;
  const profileStats = profileUserStats[0] as
    | { allUserIds?: mongoose.Types.ObjectId[]; studentUserIds?: mongoose.Types.ObjectId[]; facultyUserIds?: mongoose.Types.ObjectId[] }
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
    totalGroups,
    totalOfficialGroups,
    totalCasualGroups,
  };
};

export const getUniversityByRealId = async (id: string) => {
  return await universityModal.findById(new mongoose.Types.ObjectId(id));
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
