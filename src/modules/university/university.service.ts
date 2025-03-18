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
  return await universityModal.findById(id);
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

  const cityConditions = [];
  if (city) {
    cityConditions.push({ 'wikiInfoBox.Location': { $regex: city, $options: 'i' } });
    cityConditions.push({ 'collegeBoardInfo.Location': { $regex: city, $options: 'i' } });
  }

  const searchConditions = [];
  if (name) {
    searchConditions.push({ name: { $regex: name, $options: 'i' } });
  }
  if (country) {
    searchConditions.push({ country: { $regex: country, $options: 'i' } });
  }
  if (region) {
    searchConditions.push({ region: { $regex: region, $options: 'i' } });
  }
  if (type) {
    searchConditions.push({ 'wikiInfoBox.Type': { $regex: type, $options: 'i' } });
  }

  const searchQuery: any = {};
  if (cityConditions.length > 0 && searchConditions.length > 0) {
    searchQuery.$and = [{ $or: cityConditions }, ...searchConditions];
  } else if (cityConditions.length > 0) {
    searchQuery.$or = cityConditions;
  } else if (searchConditions.length > 0) {
    searchQuery.$and = searchConditions;
  }

  const Universities = await universityModal.find(searchQuery).skip(startIndex).limit(limit);

  const totalUniversities = await universityModal.countDocuments(searchQuery);
  const totalPages = Math.ceil(totalUniversities / limit);

  return {
    Universities,
    currentPage: page,
    totalPages,
    totalUniversities,
  };
};

export const searchUniversityByQuery = async (searchTerm: string) => {
  const universities = await universityModal.find({
    $or: [{ name: { $regex: searchTerm, $options: 'i' } }, { country: { $regex: searchTerm, $options: 'i' } }],
  });

  return universities;
};
