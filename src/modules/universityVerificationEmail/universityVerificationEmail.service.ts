import httpStatus from 'http-status';
import { ApiError } from '../errors';
import universityVerificationEmailModal from './universityVerificationEmail.modal';

export const createUniversityEmailVerificationOtp = async (email: string) => {
  const data = {
    email,
    otp: Math.floor(100000 + Math.random() * 900000),
    otpValidTill: Date.now() + 30 * 10000,
  };

  const universityVerificationEmail = await universityVerificationEmailModal.findOne({ email });

  if (!universityVerificationEmail) {
    await universityVerificationEmailModal.create(data);
  } else {
    const updatedData = { ...data };
    await universityVerificationEmailModal.updateOne({ email }, updatedData);
  }
};

export const checkUniversityEmailVerificationOtp = async (otp: string, email: string) => {
  const universityVerificationEmail = await universityVerificationEmailModal.findOne({ email });

  if (!universityVerificationEmail) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Verification data not found');
  }

  const otpValidTillUTC = new Date(universityVerificationEmail.otpValidTill).toISOString();
  const currentUTC = new Date(Date.now()).toISOString();

  // if (universityVerificationEmail.otpValidTill.getTime() < Date.now()) {
  //   throw new ApiError(httpStatus.UNAUTHORIZED, 'OTP has expired!');
  // }

  if (new Date(otpValidTillUTC).getTime() < new Date(currentUTC).getTime()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'OTP has expired!');
  }

  if (Number(universityVerificationEmail.otp) !== Number(otp)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid OTP!');
  }

  await universityVerificationEmail.deleteOne();
};
