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
  if (name) {
    searchConditions.push({ name: { $regex: name, $options: 'i' } });
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

  const searchQuery: any = searchConditions.length > 0 ? { $and: searchConditions } : {};

  const Universities = await universityModal.find(searchQuery).sort({ total_students: -1 }).skip(startIndex).limit(limit);
  const totalUniversities = await universityModal.countDocuments(searchQuery);
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
