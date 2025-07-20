import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import * as universityService from './university.service';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { userIdExtend } from 'src/config/userIDType';
import { SearchParamsType } from './university.interface';

// create university
export const createUniversity = async (req: Request, res: Response) => {
  let university;

  try {
    university = await universityService.createUniversity(req.body);
    return res.status(httpStatus.CREATED).send(university);
  } catch (error) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create!' });
  }
};

// update university
export const updateUniversity = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  try {
    if (typeof id == 'string') {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid university ID'));
      }
      await universityService.updateUniversity(new mongoose.Types.ObjectId(id), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    res.status(error.statusCode).json({ message: error.message });
  }
};

// delete university
export const deleteUniversity = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  try {
    if (typeof id == 'string') {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid university ID'));
      }
      await universityService.deleteUniversity(new mongoose.Types.ObjectId(id));
    }
    return res.status(200).json({ message: 'deleted' });
  } catch (error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete'));
  }
};

// get All university
export const getAllUniversity = async (req: Request, res: Response, next: NextFunction) => {
  const { page, limit, searchQuery } = req.query;

    let searchParams: SearchParamsType  = {};

  if (searchQuery) {
    try {
      searchParams = JSON.parse(searchQuery as string);

      // Additional structure validation if needed:
      if (typeof searchParams !== 'object' || Array.isArray(searchParams)) {
        throw new Error('Invalid searchQuery format.');
      }
    } catch (error) {
      console.error('Invalid searchQuery:', error);
      return (new ApiError(httpStatus.BAD_REQUEST, 'Invalid searchQuery. Ensure it is valid JSON.'));
    }
  }

  

   try {
    const allUniversity = await universityService.getAllUniversity(
      Number(page) || 1,
      Number(limit) || 10,
      searchParams['Search'] || '',
      searchParams['city'] || '',
      searchParams['country'] || '',
      searchParams['region'] || '',
      searchParams['type'] || ''
    );

    return res.status(200).json(allUniversity);
  } catch (error) {
    console.error('Error in getAllUniversity:', error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get University'));
  }
};

// get one university
export const getUniversityById = async (req: Request, res: Response, next: NextFunction) => {
  const { university_name } = req.params;
  try {
    let university = await universityService.getUniversityById(decodeURIComponent(university_name as string));
    return res.status(200).json(university);
  } catch (error) {
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get University'));
  }
};

// search by name or country
export const searchUniversityByQuery = async (req: Request, res: Response, next: NextFunction) => {
  const { searchTerm, page, limit } = req.query;

  try {
    const result = await universityService.searchUniversityByQuery(String(searchTerm), Number(page), Number(limit));
    res.status(200).json({ result });
  } catch (error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'No university Found!'));
  }
};

export const verifyUniversityEmail = async (req: userIdExtend, res: Response, next: NextFunction) => {
  const { searchTerm, page, limit } = req.body;

  try {
    const result = await universityService.searchUniversityByQuery(String(searchTerm), Number(page), Number(limit));
    res.status(200).json({ result });
  } catch (error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'No university Found!'));
  }
};
