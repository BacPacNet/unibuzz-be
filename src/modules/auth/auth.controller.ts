import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { tokenService } from '../token';
import { userService } from '../user';
import * as authService from './auth.service';
import { emailService } from '../email';
import { userProfileService } from '../userProfile';
import { userFollowService } from '../userFollow';

// import { parse } from 'date-fns';

export const register = catchAsync(async (req: Request, res: Response) => {
  const {
    dob,
    country,
    city,
    universityEmail,
    universityName,
    year,
    degree,
    major,
    occupation,
    department,
    universityId,
    ...body
  } = req.body;

  const user = await userService.registerUser(body);
  const userProfile = await userProfileService.createUserProfile(
    user._id,
    dob,
    country,
    city,
    universityEmail,
    universityName,
    year,
    degree,
    major,
    occupation,
    department,
    universityId
  );
  const tokens = await tokenService.generateAuthTokens(user);
  res.status(httpStatus.CREATED).send({ user, tokens, userProfile });
});

export const register_v2 = catchAsync(async (req: Request, res: Response) => {
  const {
    birthDate,
    country,
    universityEmail,
    universityName,
    universityId,
    year,
    degree,
    major,
    occupation,
    department,
    ...body
  } = req.body;

  // const dob = parse(birthDate, 'dd/MM/yyyy', new Date());

  const user = await userService.registerUser(body);
  await userProfileService.createUserProfile(
    user._id,
    birthDate,
    country,
    '',
    universityEmail,
    universityName,
    year,
    degree,
    major,
    occupation,
    department,
    universityId
  );
  await userService.joinCommunityAfterEmailVerification(user._id, universityName, universityEmail);

  res.status(httpStatus.CREATED).send({ message: 'Registered Successfully', isRegistered: true });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const userProfile = await userProfileService.getUserProfile(user.id);
  const Following = await userFollowService.getFollowCounts(user.id);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens, userProfile, Following });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

export const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  const userWithTokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...userWithTokens });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await authService.resetPassword(req.query['token'], req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});
