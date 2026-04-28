import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { tokenService } from '../token';
import { userService } from '../user';
import * as authService from './auth.service';
import { emailService } from '../email';
import { userProfileService } from '../userProfile';
import { userFollowService } from '../userFollow';
import resetPasswordOTPModel from '../resetPasswordOTP/resetPasswordOTP.model';
import { communityService } from '../community';
import { universityVerificationEmailService } from '../universityVerificationEmail';
import { superAdminsService } from '../superAdmins';
import { ApiError } from '../errors';
import { SuperAdminBulkRegisterItem } from '../user/user.interfaces';
import { queueSQSNotification } from '../../amazon-sqs/sqsWrapperFunction';
import { NotificationIdentifier } from '../../amazon-sqs/NotificationIdentifierEnums';

export const register_v2 = catchAsync(async (req: Request, res: Response) => {
  try {
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
      userType,
      isJoinUniversity,
      isUniversityVerified,
      universityLogo,
      isEmailVerified,
      ...body
    } = req.body;

    // Register user
    const user = await userService.registerUser(body);
    const { _id: userId } = user;

    // Create user profile
    await userProfileService.createUserProfile(userId.toString(), req.body);

    // Handle university-related actions
    if (isUniversityVerified || isJoinUniversity) {
      const community = await communityService.joinCommunityFromUniversity(
        userId.toString(),
        universityId,
        isUniversityVerified
      );
      if (isUniversityVerified) {
        const { data } = community as any;
        await userProfileService.addUniversityEmail(
          userId.toString(),
          universityEmail,
          universityName,
          data.community._id.toString(),
          data.community.communityLogoUrl.imageUrl.toString()
        );
        await universityVerificationEmailService.upsertCompletedUniversityVerificationForRegistration(
          universityEmail,
          universityId
        );
      }
    }

    res.status(httpStatus.CREATED).send({ message: 'Registered Successfully', isRegistered: true });
  } catch (error: any) {
    console.error('Registration failed:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ message: 'Registration failed', error: error.message });
  } finally {
    // Always end the session to free up resources
  }
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const userProfile = await userProfileService.getUserProfile(user.id);
  const Following = await userFollowService.getFollowCounts(user.id);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens, userProfile, Following });
});

export const dashboardLogin = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const allowed = await superAdminsService.isSuperAdminByEmail(email);

  if (!allowed) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only super admins can access this resource');
  }
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  // const userProfile = await userProfileService.getUserProfile(user.id);
  // const Following = await userFollowService.getFollowCounts(user.id);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
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

export const sendResetPasswordOTP = async (req: Request, res: Response) => {
  const email = req.query['email'] as string;

  try {
    await authService.sendResetOTP(email);
    return res.status(200).json({ message: 'OTP has been sent successfully' });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const verifyResetPassword = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
  try {
    const validOTP = await resetPasswordOTPModel.findOne({ email, otp });
    if (!validOTP) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const generateResetToken = () => {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const resetToken = generateResetToken();

    // Store reset token in OTP document
    await resetPasswordOTPModel.updateOne({ email, otp }, { resetToken });

    res.json({ message: 'OTP verified', resetToken });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email, resetToken, newPassword } = req.body;

  try {
    await authService.resetPassword(email, resetToken, newPassword);
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
});

export const bulkRegisterUsersBySuperAdmin = catchAsync(async (req: Request, res: Response) => {
 

  const payload = req.body as SuperAdminBulkRegisterItem[];
  const results: Array<{ index: number; email?: string; uniqueId?: string; status: 'success' | 'failed'; error?: string }> =
    [];

  for (const [index, userPayload] of payload.entries()) {
    const {
      birthDate,
      birthday,
      country,
      universityName,
      universityId,
      year,
      degree,
      major,
      occupation,
      department,
      affiliation,
      userType,
      universityLogo,
      isEmailVerified,
      password,
      ...body
    } = userPayload;


    try {
      const normalizedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
      const normalizedUniversityNameNoSpaces = universityName
      ? universityName.replace(/\s+/g, '').toLowerCase()
      : '';
      const generatedUserName =normalizedUniversityNameNoSpaces + (body?.uniqueId ?  body?.uniqueId : '');
    

      const registerBody = {
        ...body,
        email: normalizedEmail,
        userName: generatedUserName,
        password: password,
        gender: body.gender || 'not_specified',
        isPasswordSet: false,
      } as any;
      if (registerBody.uniqueId && universityId) {
        const isUniqueIdAlreadyUsedInUniversity = await userService.isUniqueIdTakenInUniversity(
          registerBody.uniqueId,
          universityId,
          universityName
        );
        if (isUniqueIdAlreadyUsedInUniversity) {
          throw new ApiError(
            httpStatus.CONFLICT,
            `Unique ID ${registerBody.uniqueId} already exists for this university`
          );
        }
      }
      // return console.log("registerBody",registerBody);
      const user = await userService.registerUser(registerBody);
      const { _id: userId } = user;

      const profilePayload = {
        ...userPayload,
        birthDate: birthDate || birthday || '',
        department: department || affiliation || '',
      };
      await userProfileService.createUserProfile(userId.toString(), profilePayload);

      const shouldJoinUniversity =  Boolean(universityId);
      const shouldMarkUniversityVerified = true;
      const universityEmail = user.email;

      if (shouldJoinUniversity && universityId) {
        const community = await communityService.joinCommunityFromUniversity(
          userId.toString(),
          universityId || '',
          shouldMarkUniversityVerified
        );

        if (shouldMarkUniversityVerified && universityEmail && universityName) {
          const { data } = community as any;
          
          await userProfileService.addUniversityEmail(
            userId.toString(),
            universityEmail || '',
            universityName || '',
            data.community._id.toString(),
            data.community.communityLogoUrl.imageUrl.toString()
          );
          await universityVerificationEmailService.upsertCompletedUniversityVerificationForRegistration(
            universityEmail || '',
            universityId || ''
          );
        }
      }

      await userService.updateUserById(userId as any, { isEmailVerified: isEmailVerified ?? true });

      try {
        await queueSQSNotification({
          type: NotificationIdentifier.INSTITUTIONAL_ACCOUNT_CREATED_EMAIL,
          email: normalizedEmail,
          firstName: body.firstName,
          userStatus: userPayload.userType || 'student',
          temporaryPassword: password || '',
        });
      } catch (queueError: any) {
        console.error(`Failed to enqueue onboarding email for ${normalizedEmail}:`, queueError?.message || queueError);
      }

      const successResult: { index: number; email: string; uniqueId?: string; status: 'success' } = {
        index,
        email: normalizedEmail,
        status: 'success',
      };
      if (body.uniqueId) successResult.uniqueId = body.uniqueId || '';
      results.push(successResult);
    } catch (error: any) {
      const failedResult: { index: number; email: string; uniqueId?: string; status: 'failed'; error: string } = {
        index,
        email: userPayload.email,
        status: 'failed',
        error: error?.message || 'Registration failed',
      };
      if (userPayload.uniqueId) failedResult.uniqueId = userPayload.uniqueId || '';
      results.push(failedResult);
    }
  }

  const successResults = results.filter((item) => item.status === 'success');
  const failedResults = results
    .filter((item) => item.status === 'failed')
    .map((item) => ({
      index: item.index,
      email: item.email,
      uniqueId: item.uniqueId,
      status: item.status,
      err: item.error || 'Registration failed',
    }));

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Bulk registration processed',
    summary: {
      total: payload.length,
      valid: successResults.length,
      invalid: failedResults.length,
    },
    data: {
      results: successResults,
      failed: failedResults,
    },
  });
});
