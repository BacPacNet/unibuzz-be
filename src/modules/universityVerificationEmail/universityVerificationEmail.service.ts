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

  if (universityVerificationEmail.otpValidTill.getTime() < Date.now()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'OTP has expired!');
  }

  if (Number(universityVerificationEmail.otp) !== Number(otp)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid OTP!');
  }

  universityVerificationEmail.isEmailVerified = true;

  await universityVerificationEmail.save();
};
