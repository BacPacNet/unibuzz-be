interface universityVerificationEmailinterface {
  email: string;
  otp: number;
  isEmailVerified: boolean;
  otpValidTill: Date;
}

export { universityVerificationEmailinterface };
