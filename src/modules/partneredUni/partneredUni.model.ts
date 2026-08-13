import { Schema, model } from 'mongoose';
import { IPartneredUni } from './partneredUni.interface';

const partneredUniSchema = new Schema<IPartneredUni>(
  {
    universityId: {
      type: Schema.Types.ObjectId,
      ref: 'university',
      required: true,
    },
    communityId: {
      type: Schema.Types.ObjectId,
      ref: 'community',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);



const PartneredUniModel = model<IPartneredUni>('partneredUni', partneredUniSchema);

export default PartneredUniModel;
