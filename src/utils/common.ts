import mongoose from 'mongoose';

export const convertToObjectId = (id: string) => {
  return new mongoose.Types.ObjectId(id);
};
