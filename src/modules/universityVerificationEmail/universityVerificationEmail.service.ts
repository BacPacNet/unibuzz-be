import httpStatus from 'http-status';
import { ApiError } from '../errors';
import universityVerificationEmailModal from './universityVerificationEmail.modal';
import { sendEmail } from '../email/email.service';
import { universityModal } from '../university';
import { UniversityVerificationEmailStatus } from './universityVerificationEmail.interface';
import { universityUsersService } from '../universityUsers';

const extractDomainFromEmail = (email: string) => email.split('@')[1]?.toLowerCase().trim() || '';

const isDomainMatch = (emailDomain: string, universityDomain: string) => {
  const normalizedEmailDomain = emailDomain.toLowerCase().trim();
  const normalizedUniversityDomain = universityDomain.toLowerCase().trim().replace(/^@/, '');

  if (!normalizedEmailDomain || !normalizedUniversityDomain) {
    return false;
  }

  return (
    normalizedEmailDomain === normalizedUniversityDomain ||
    normalizedEmailDomain.endsWith(`.${normalizedUniversityDomain}`) ||
    normalizedUniversityDomain.endsWith(`.${normalizedEmailDomain}`)
  );
};

const hasUniversityDomainMatch = (emailDomain: string, universityDomains: string[]) => {
  if (!emailDomain) {
    return false;
  }

  return universityDomains.some((domain: string) => isDomainMatch(emailDomain, domain));
};

export const createUniversityEmailVerificationOtp = async (email: string, universityId: string) => {
  const emailDomain = extractDomainFromEmail(email);

  const university = await universityModal.findOne({  _id: universityId })


  if (!emailDomain) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid email domain.');
  }

  const universityUsers = await universityUsersService.findUniversityUsersAgg(email, universityId, "", "");


  

  const universityDomains = university?.domains || [];

  const hasMatchedDomain = hasUniversityDomainMatch(emailDomain, universityDomains);

  if (!hasMatchedDomain && !universityUsers) {
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
  const emailDomain = extractDomainFromEmail(email);
  const university = await universityModal.findOne({ _id: universityId });
  const universityVerificationEmail = await universityVerificationEmailModal.findOne({ email });
  const hasMatchedDomain = hasUniversityDomainMatch(emailDomain, university?.domains || []);
  if (!university || !hasMatchedDomain) {
    return false;
  }
  if (universityVerificationEmail?.status === UniversityVerificationEmailStatus.COMPLETE) {
    return false;
  }
  return true;
};
