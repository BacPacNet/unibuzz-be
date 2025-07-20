import { Schema, model } from 'mongoose';
import { universityVerificationEmailinterface } from './universityVerificationEmail.interface';

const universityVerificationEmailSchema = new Schema<universityVerificationEmailinterface>({
  email: { type: String, required: true, unique: true },
  otp: { type: Number, required: true },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  otpValidTill: { type: Date, required: true },
});

const universityVerificationEmailModal = model<universityVerificationEmailinterface>(
  'universityVerificationEmail',
  universityVerificationEmailSchema
);

export default universityVerificationEmailModal;
