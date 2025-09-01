interface universityVerificationEmailinterface {
  email: string;
  otp: number;
  isEmailVerified: boolean;
  otpValidTill: Date;
  expireAt: Date;
}

export { universityVerificationEmailinterface };
