import httpStatus from 'http-status';
import { ApiError } from '../errors';
import loginEmailVerificationModal from './loginEmailVerification.modal';

export const createloginEmailVerificationOtp = async (email: string) => {
  const data = {
    email,
    otp: Math.floor(100000 + Math.random() * 900000),
    otpValidTill: Date.now() + 30 * 10000,
  };

  const loginEmailVerification = await loginEmailVerificationModal.findOne({ email });

  if (!loginEmailVerification) {
    await loginEmailVerificationModal.create(data);
  } else {
    const updatedData = { ...data };
    await loginEmailVerificationModal.updateOne({ email }, updatedData);
  }
};

export const checkloginEmailVerificationOtp = async (otp: string, email: string) => {
  const loginEmailVerification = await loginEmailVerificationModal.findOne({ email });

  if (!loginEmailVerification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Verification data not found');
  }

  if (loginEmailVerification.otpValidTill.getTime() < Date.now()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'OTP has expired!');
  }

  if (Number(loginEmailVerification.otp) !== Number(otp)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid OTP!');
  }

  loginEmailVerification.isEmailVerified = true;

  await loginEmailVerification.save();
};
