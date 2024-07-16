import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import config from '../../config/config';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// Middleware function to verify JWT and extract userId
export const userIdAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]; // Assuming JWT is passed in Authorization header

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const decoded: any = jwt.verify(token, config.jwt.secret);

    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Expired Token');
    }

    req.userId = decoded.sub;

    next();
  } catch (error: any) {
    return res.status(401).json({ message: error.message });
  }
};
