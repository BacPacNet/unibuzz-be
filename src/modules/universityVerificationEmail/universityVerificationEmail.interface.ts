export enum UniversityVerificationEmailStatus {
  PENDING = 'pending',
  COMPLETE = 'complete',
}

interface universityVerificationEmailinterface {
  email: string;
  otp: number;
  isEmailVerified: boolean;
  otpExpiresAt: Date;
  universityId: string;
  status: UniversityVerificationEmailStatus;
}

export { universityVerificationEmailinterface };
