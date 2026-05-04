import { Schema, model } from 'mongoose';
import { ISuperAdmin } from './superAdmins.interface';

const superAdminsSchema = new Schema<ISuperAdmin>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

const SuperAdminsModel = model<ISuperAdmin>('superAdmins', superAdminsSchema);

export default SuperAdminsModel;
