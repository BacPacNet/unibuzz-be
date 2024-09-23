interface loginEmailVerificationInterface {
  email: string;
  otp: number;
  isEmailVerified: boolean;
  otpValidTill: Date;
}

export { loginEmailVerificationInterface };
