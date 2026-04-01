import mongoose from 'mongoose';
import { AppPlatform, IAppVersionPolicy } from './appVersion.interface';

export type AppVersionPolicyDoc = mongoose.Document & IAppVersionPolicy;

const appVersionPolicySchema = new mongoose.Schema<AppVersionPolicyDoc>(
  {
    platform: {
      type: String,
      enum: ['android', 'ios'] satisfies AppPlatform[],
      required: true,
      unique: true,
      index: true,
    },
    enabled: { type: Boolean, required: true, default: false },
    softBlock: { type: String, required: true, default: '0.0.0' },
    softMessage: { type: String, required: true, default: 'A new update is available.' },
    hardBlock: { type: String, required: true, default: '0.0.0' },
    hardMessage: { type: String, required: true, default: 'Please update your app to continue.' },
    updateUrl: { type: String, required: false },
    blockIfMissingVersion: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export const AppVersionPolicy = mongoose.model<AppVersionPolicyDoc>('AppVersionPolicy', appVersionPolicySchema);

