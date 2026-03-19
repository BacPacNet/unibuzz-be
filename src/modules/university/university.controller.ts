import httpStatus from 'http-status';
import { Request, Response } from 'express';
import * as universityService from './university.service';
import { ApiError } from '../errors';
import { userIdExtend } from 'src/config/userIDType';
import { SearchParamsType } from './university.interface';
import catchAsync from '../utils/catchAsync';


// get All university
export const getAllUniversity = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, searchQuery } = req.query;

  let searchParams: SearchParamsType = {};

  if (searchQuery) {
    try {
      searchParams = JSON.parse(searchQuery as string);
      if (typeof searchParams !== 'object' || Array.isArray(searchParams)) {
        throw new Error('Invalid searchQuery format.');
      }
    } catch {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid searchQuery. Ensure it is valid JSON.');
    }
  }

  const allUniversity = await universityService.getAllUniversity(
    Number(page) || 1,
    Number(limit) || 10,
    searchParams['Search'] || '',
    searchParams['city'] || '',
    searchParams['country'] || '',
    searchParams['region'] || '',
    searchParams['type'] || ''
  );

  return res.status(httpStatus.OK).json(allUniversity);
});

// get one university
export const getUniversityById = catchAsync(async (req: Request, res: Response) => {
  const { university_name } = req.params;
  const university = await universityService.getUniversityById(decodeURIComponent(university_name as string));
  return res.status(httpStatus.OK).json(university);
});

// search by name or country
export const searchUniversityByQuery = catchAsync(async (req: Request, res: Response) => {
  const { searchTerm, page, limit } = req.query;
  const result = await universityService.searchUniversityByQuery(String(searchTerm), Number(page), Number(limit));
  return res.status(httpStatus.OK).json({ result });
});

export const verifyUniversityEmail = catchAsync(async (req: userIdExtend, res: Response) => {
  const { searchTerm, page, limit } = req.body;
  const result = await universityService.searchUniversityByQuery(String(searchTerm), Number(page), Number(limit));
  return res.status(httpStatus.OK).json({ result });
});
