import { Schema, model } from 'mongoose';
import {
  UniversityVerificationEmailStatus,
  universityVerificationEmailinterface,
} from './universityVerificationEmail.interface';

const universityVerificationEmailSchema = new Schema<universityVerificationEmailinterface>({
  email: { type: String, required: true, unique: true },
  universityId: { type: String, required: true },
  otp: { type: Number, required: true },
  status: {
    type: String,
    enum: Object.values(UniversityVerificationEmailStatus),
    default: UniversityVerificationEmailStatus.PENDING,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  otpExpiresAt: { type: Date, required: true },
});

const universityVerificationEmailModal = model<universityVerificationEmailinterface>(
  'universityVerificationEmail',
  universityVerificationEmailSchema
);

export default universityVerificationEmailModal;
