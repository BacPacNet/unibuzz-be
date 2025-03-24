import httpStatus from 'http-status';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Token from '../token/token.model';
import ApiError from '../errors/ApiError';
import tokenTypes from '../token/token.types';
import { getUserByEmail, getUserById, updateUserById } from '../user/user.service';
import { IUserDoc, IUserWithTokens } from '../user/user.interfaces';
import { generateAuthTokens, verifyToken } from '../token/token.service';
import resetPasswordOTPModel from '../resetPasswordOTP/resetPasswordOTP.model';
import User from '../user/user.model';

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<IUserDoc>}
 */
export const loginUserWithEmailAndPassword = async (email: string, password: string): Promise<IUserDoc> => {
  const user = await getUserByEmail(email);
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
export const logout = async (refreshToken: string): Promise<void> => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.deleteOne();
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<IUserWithTokens>}
 */
export const refreshAuth = async (refreshToken: string): Promise<IUserWithTokens> => {
  try {
    const refreshTokenDoc = await verifyToken(refreshToken, tokenTypes.REFRESH);
    const user = await getUserById(new mongoose.Types.ObjectId(refreshTokenDoc.user));
    if (!user) {
      throw new Error();
    }
    await refreshTokenDoc.deleteOne();
    const tokens = await generateAuthTokens(user);
    return { user, tokens };
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export const resetPassword = async (email: string, resetToken: string, newPassword: string): Promise<void> => {
  if (!email || !resetToken || !newPassword) throw new Error('Email, reset token, and new password are required');

  try {
    // Verify reset token
    const validOTP = await resetPasswordOTPModel.findOne({ email, resetToken });
    if (!validOTP) throw new Error('Invalid or expired token');

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await User.findOneAndUpdate({ email }, { password: hashedPassword }, { upsert: true });

    // Delete OTP entry after password reset
    await resetPasswordOTPModel.deleteOne({ email, resetToken });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

export const sendResetOTP = async (email: string) => {
  if (!process.env['EMAIL_FROM']) {
    return new Error('Missing EMAIL_FROM in environment variables');
  }

  const isEmailExist = await getUserByEmail(email);

  if (isEmailExist === null) {
    throw new Error('Email does not exist');
  }

  const data = {
    email,
    otp: Math.floor(100000 + Math.random() * 900000),
    otpValidTill: Date.now() + 30 * 10000,
  };
  console.log(data);

  const isEmailExistInResetPassword = await resetPasswordOTPModel.findOne({ email });

  if (!isEmailExistInResetPassword) {
    await resetPasswordOTPModel.create(data);
  } else {
    const updatedData = { ...data };
    await resetPasswordOTPModel.updateOne({ email }, updatedData);
  }
};

/**
 * Verify email
 * @param {string} verifyEmailToken
 * @returns {Promise<IUserDoc | null>}
 */
export const verifyEmail = async (verifyEmailToken: any): Promise<IUserDoc | null> => {
  try {
    const verifyEmailTokenDoc = await verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const user = await getUserById(new mongoose.Types.ObjectId(verifyEmailTokenDoc.user));
    if (!user) {
      throw new Error();
    }
    await Token.deleteMany({ user: user.id, type: tokenTypes.VERIFY_EMAIL });
    const updatedUser = await updateUserById(user.id, { isEmailVerified: true });
    return updatedUser;
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};
