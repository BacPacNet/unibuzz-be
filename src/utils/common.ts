import { ApiError } from '../modules/errors'
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { userIdExtend } from '../config/userIDType';

export const convertToObjectId = (id: string) => {
  return new mongoose.Types.ObjectId(id);
};

/**
 * Returns true if the value is a valid MongoDB ObjectId (string or ObjectId).
 */
export function isValidObjectId(id: string | mongoose.Types.ObjectId | undefined | null): boolean {
  return id != null && mongoose.Types.ObjectId.isValid(id);
}


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

export function parseUserIdOrThrow(userId: unknown): mongoose.Types.ObjectId {
  if (typeof userId !== 'string' || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID');
  }
  return new mongoose.Types.ObjectId(userId);
}






export type PaginationQuery = {
  page?: string;
  limit?: string;
};
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

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



/**
 * Returns skip offset for pagination (0-based).
 */
export const getPaginationSkip = (page: number, limit: number): number => (page - 1) * limit;

/**
 * Returns total number of pages for a given total count and limit.
 */
export const computeTotalPages = (total: number, limit: number): number => Math.ceil(total / limit);

/**
 * Builds a consistent pagination response object.
 */
export function buildPaginationResponse(
  total: number,
  page: number,
  limit: number
): { total: number; page: number; limit: number; totalPages: number } {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
