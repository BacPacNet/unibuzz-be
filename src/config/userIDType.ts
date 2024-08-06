import { Request } from 'express';

export interface userIdExtend extends Request {
  userId?: string;
}
