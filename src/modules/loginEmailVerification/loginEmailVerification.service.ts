import httpStatus from 'http-status';
import { ApiError } from '../errors';
import loginEmailVerificationModal from './loginEmailVerification.modal';
import 'dotenv/config';
// import { sendEmail } from '../email/email.service';

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

  // await sendEmail(
  //   email,
  //   'Verify Your Email Address - OTP Code Inside',
  //   '',
  //   `
  //   <p>Thank you for registering with <strong>Unibuzz</strong>. To complete your email verification, please enter the following One-Time Password (OTP) on the verification page:</p>
  //   <h2>${data.otp}</h2>
  //   <p>This OTP is valid for the next <strong>5 minutes</strong>. Please do not share this code with anyone for security reasons.</p>
  //   <p>If you did not request this verification, please ignore this email.</p>
  //   <br>
  //   <p>Best regards,<br><strong>Unibuzz</strong> Support Team</p>
  //   <p>Contact: info@unibuzz.org</p>
  // `
  // );
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

  await loginEmailVerification.deleteOne();
};
