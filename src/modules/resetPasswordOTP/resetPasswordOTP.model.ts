import { Schema, model } from 'mongoose';
import { resetPasswordOTPInterface } from './resetPasswordOTP.interface';

const resetPasswordOTPSchema = new Schema<resetPasswordOTPInterface>({
  email: { type: String, required: true, unique: true },
  otp: { type: Number, required: true },
  resetToken: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 300 },
});

const resetPasswordOTPModel = model<resetPasswordOTPInterface>('resetPasswordOTP', resetPasswordOTPSchema);

export default resetPasswordOTPModel;
