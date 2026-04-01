import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import * as appVersionService from './appVersion.service';
import { AppPlatform } from './appVersion.interface';


export const required = catchAsync(async (req: Request, res: Response) => {
  const platformFromHeader = (req.header('x-client-platform') || req.header('x-platform')) as AppPlatform | undefined;
  if (!platformFromHeader) {
    return res.status(httpStatus.OK).json({ shouldUpdate: false, message: '' });
  }
  const platform = platformFromHeader ?? null;
  const current = (req.header('x-app-version') || req.header('x-version') || (req.query['current'] as string | undefined) || '') ?? '';

  const policy = await appVersionService.getPolicy(platform);
  if (!policy || !policy.enabled) {
    return res.status(httpStatus.OK).json({
      shouldUpdate: false,
      message: '',
    });
  }

  try {
    const result = await appVersionService.evaluateVersion({
      platform,
      currentVersionRaw: current,
      treatMissingAsBlocked: false,
    });
    return res.status(httpStatus.OK).json({
      shouldUpdate: result.shouldSoftBlock,
      message: result.shouldSoftBlock ? policy.softMessage || '' : '',
    });
  } catch (err: any) {
    return res
      .status(httpStatus.OK)
      .json({ shouldUpdate: true, message: err?.message ?? policy.hardMessage ?? 'Please update your app to continue.' });
  }
});

