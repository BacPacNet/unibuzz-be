import { Schema, model } from 'mongoose';
import { loginEmailVerificationInterface } from './loginEmailVerification.interface';

const loginEmailVerificationSchema = new Schema<loginEmailVerificationInterface>({
  email: { type: String, required: true, unique: true },
  otp: { type: Number, required: true },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  otpValidTill: { type: Date, required: true },
});

const loginEmailVerificationModal = model<loginEmailVerificationInterface>(
  'loginEmailVerification',
  loginEmailVerificationSchema
);

export default loginEmailVerificationModal;
