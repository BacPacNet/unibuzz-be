import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import * as universityService from './university.service';
import mongoose from 'mongoose';
import { ApiError } from '../errors';

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
  const { page, limit } = req.query;
  let allUniversity;

  try {
    allUniversity = await universityService.getAllUniversity(Number(page), Number(limit));
    return res.status(200).json({ allUniversity });
  } catch (error) {
    console.log(req);
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get University'));
  }
};

// search by name or country
export const searchUniversityByQuery = async (req: Request, res: Response, next: NextFunction) => {
  const { searchTerm } = req.query;

  try {
    const result = await universityService.searchUniversityByQuery(String(searchTerm));
    res.status(200).json({ result });
  } catch (error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'No university Found!'));
  }
};
