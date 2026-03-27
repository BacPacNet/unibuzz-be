import httpStatus from 'http-status';
import { ApiError } from '../errors';
import universityVerificationEmailModal from './universityVerificationEmail.modal';
import { sendEmail } from '../email/email.service';
import { universityModal } from '../university';
import { UniversityVerificationEmailStatus } from './universityVerificationEmail.interface';

export const createUniversityEmailVerificationOtp = async (email: string, universityId: string) => {
  const splitedEmail = email.split(".");
  const finalDomain = `${splitedEmail[splitedEmail?.length - 2]}.${splitedEmail[splitedEmail?.length - 1]}`;

  const finalDomainWithoutAt = finalDomain.includes('@') ? finalDomain.split('@')[1] : finalDomain;

  const university = await universityModal.findOne({  _id: universityId })


  if (!finalDomainWithoutAt) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email domain.');
  }

  const universityDomains = university?.domains || [];

  if (!universityDomains?.includes(finalDomainWithoutAt)) {
    throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Email domain is not associated with this university.');
  }
  const data = {
    email,
    universityId,
    otp: Math.floor(100000 + Math.random() * 900000),
    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    status: UniversityVerificationEmailStatus.PENDING,
    isEmailVerified: false,
  };

  const universityVerificationEmail = await universityVerificationEmailModal.findOne({ email });

  if (!universityVerificationEmail) {
    await universityVerificationEmailModal.create(data);
  } else {
    if (universityVerificationEmail.status === UniversityVerificationEmailStatus.COMPLETE) {
      throw new ApiError(httpStatus.CONFLICT, 'This university email has already been verified and cannot be used again.');
    }
    const updatedData = { ...data };
    await universityVerificationEmailModal.updateOne(
      { email },
      { $set: updatedData, $unset: { otpValidTill: "" } }
    );
  }

  await sendEmail(
    email,
    'Verify Your university Email Address - OTP Code Inside',
    '',
    `
    <p>Thank you for registering with <strong>Unibuzz</strong>. To complete your university email verification, please enter the following One-Time Password (OTP) on the  university verification page:</p>
    <h2>${data.otp}</h2>
    <p>This OTP is valid for the next <strong>5 minutes</strong>. Please do not share this code with anyone for security reasons.</p>
    <p>If you did not request this verification, please ignore this email.</p>
    <br>
    <p>Best regards,<br><strong>Unibuzz</strong> Support Team</p>
    <p>Contact: info@unibuzz.org</p>
  `
  );
};

export const checkUniversityEmailVerificationOtp = async (otp: string, email: string) => {
  const universityVerificationEmail = await universityVerificationEmailModal.findOne({ email });

  if (!universityVerificationEmail) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Verification code not found, please request a new one.');
  }

  if (universityVerificationEmail.status === UniversityVerificationEmailStatus.COMPLETE) {
    throw new ApiError(httpStatus.CONFLICT, 'This university email has already been verified.');
  }

  const otpExpiresAtUTC = new Date(universityVerificationEmail.otpExpiresAt).toISOString();
  const currentUTC = new Date(Date.now()).toISOString();

  // if (universityVerificationEmail.otpValidTill.getTime() < Date.now()) {
  //   throw new ApiError(httpStatus.UNAUTHORIZED, 'OTP has expired!');
  // }

  if (new Date(otpExpiresAtUTC).getTime() < new Date(currentUTC).getTime()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'verification code has expired.');
  }

  if (Number(universityVerificationEmail.otp) !== Number(otp)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect verification code.');
  }

  await universityVerificationEmailModal.updateOne(
    { email },
    { $set: { status: UniversityVerificationEmailStatus.COMPLETE, isEmailVerified: true } }
  );
};

export const universityEmailDomainCheck = async (email: string, universityId: string) => {
  const domain = email.split('@')[1];
  const university = await universityModal.findOne({ domains: domain, _id: universityId });
  const universityVerificationEmail = await universityVerificationEmailModal.findOne({ email });
  if (!university) {
    return false;
  }
  if (universityVerificationEmail?.status === UniversityVerificationEmailStatus.COMPLETE) {
    return false;
  }
  return true;
};
