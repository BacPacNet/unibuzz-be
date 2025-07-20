import mongoose from 'mongoose';
import universityModal from './university.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const createUniversity = async (university: any) => {
  return await universityModal.create(university);
};

export const getUniversityById = async (university_name: string) => {
  return await universityModal.findOne({ name: university_name });
};

export const getUniversityByRealId = async (id: string) => {
  return await universityModal.findById(new mongoose.Types.ObjectId(id));
};

export const updateUniversity = async (id: mongoose.Types.ObjectId, university: any) => {
  let universityToUpadate;

  universityToUpadate = await universityModal.findById(id);

  if (!universityToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found!');
  }
  Object.assign(universityToUpadate, university);
  await universityToUpadate.save();
  return universityToUpadate;
};

export const deleteUniversity = async (id: mongoose.Types.ObjectId) => {
  return await universityModal.findByIdAndDelete(id);
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

  const searchConditions: any[] = [];

  if (city) {
    searchConditions.push({ city: { $regex: city, $options: 'i' } });
  }
  if (country) {
    searchConditions.push({ country: { $regex: country, $options: 'i' } });
  }
  if (region) {
    searchConditions.push({ continent: { $regex: region, $options: 'i' } });
  }
  if (type) {
    searchConditions.push({ type: { $regex: type, $options: 'i' } });
  }
  if (name) {
    searchConditions.push({
      name: { $regex: name, $options: 'i' },
    });
  }

  const matchStage = searchConditions.length > 0 ? { $match: { $and: searchConditions } } : { $match: {} };

  const aggregation: any = [matchStage];

  if (name) {
    aggregation.push(
      {
        $addFields: {
          nameMatchRank: {
            $switch: {
              branches: [
                { case: { $eq: [{ $toLower: '$name' }, name.toLowerCase()] }, then: 0 },
                { case: { $regexMatch: { input: '$name', regex: `^${name}`, options: 'i' } }, then: 1 },
                { case: { $regexMatch: { input: '$name', regex: name, options: 'i' } }, then: 2 },
              ],
              default: 3,
            },
          },
        },
      },
      { $sort: { nameMatchRank: 1, name: 1 } },
      {
        $project: {
          nameMatchRank: 0,
        },
      }
    );
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


export const searchUniversityByQuery = async (searchTerm: string, page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const universities = await universityModal
    .find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { country: { $regex: searchTerm, $options: 'i' } },
        { type: { $regex: searchTerm, $options: 'i' } },
      ],
    })
    .skip(skip)
    .limit(limit);

  const totalCount = await universityModal.countDocuments({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { country: { $regex: searchTerm, $options: 'i' } },
      { type: { $regex: searchTerm, $options: 'i' } },
    ],
  });

  return {
    universities,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
    totalResults: totalCount,
  };
};
