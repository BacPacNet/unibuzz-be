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
        const { data } = community;
        await userProfileService.addUniversityEmail(
          userId.toString(),
          universityEmail,
          universityName,
          data.community._id.toString(),
          data.community.communityLogoUrl.imageUrl.toString()
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
