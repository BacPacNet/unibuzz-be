import mongoose from 'mongoose';
import universityModal from './university.model';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const createUniversity = async (university: any) => {
  return await universityModal.create(university);
};

export const getUniversityById = async (university_name: string) => {
  return await universityModal.findOne({ pathUrl: university_name });
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

export const getAllUniversity = async (page: number, limit: number) => {
  const Currpage = page ? page : 1;
  const limitpage = limit ? limit : 10;
  const startIndex = (Currpage - Number(1)) * Number(limitpage);

  return await universityModal.find().skip(startIndex).limit(limitpage);
};

export const searchUniversityByQuery = async (searchTerm: string) => {
  const universities = await universityModal.find({
    $or: [{ name: { $regex: searchTerm, $options: 'i' } }, { country: { $regex: searchTerm, $options: 'i' } }],
  });

  return universities;
};
