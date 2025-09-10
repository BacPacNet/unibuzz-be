interface loginEmailVerificationInterface {
  email: string;
  otp: number;
  isEmailVerified: boolean;
  otpValidTill: Date;
  expireAt: Date;
}

export { loginEmailVerificationInterface };
