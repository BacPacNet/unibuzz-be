import { ApiError } from '../modules/errors'
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { userIdExtend } from '../config/userIDType';

export const convertToObjectId = (id: string) => {
  return new mongoose.Types.ObjectId(id);
};


export function requireAuthenticatedUserIdOrThrow(req: userIdExtend): string {
  const userId = req.userId;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User ID is required');
  }
  return userId;
}



export function parsePostIdOrThrow(postId: unknown): mongoose.Types.ObjectId {
  if (typeof postId !== 'string' || !mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid post ID');
  }
  return new mongoose.Types.ObjectId(postId);
}



export function requireQueryUserIdOrThrow(userId: unknown): string {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }
  return userId;
}




export type PaginationQuery = {
  page?: string;
  limit?: string;
};
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function parsePositiveIntOrThrow(
  value: string | undefined,
  fallback: number,
  fieldName: 'page' | 'limit'
): number {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid ${fieldName}`);
  }
  return n;
}


export function parsePagination(query: PaginationQuery): { page: number; limit: number } {
  return {
    page: parsePositiveIntOrThrow(query.page, DEFAULT_PAGE, 'page'),
    limit: parsePositiveIntOrThrow(query.limit, DEFAULT_LIMIT, 'limit'),
  };
}