import mongoose from 'mongoose';
import universityModal from './university.model';
import { UniversityFilter } from './university.interface';
import { buildNameMatchRankingStages, buildSearchTermOrFilter, escapeRegex } from './university.pipeline';



export const getUniversityById = async (university_name: string) => {
  return await universityModal.findOne({ name: university_name });
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
