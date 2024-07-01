import mongoose from 'mongoose';

interface notificationInterface {
  adminId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  communityGroupId: mongoose.Types.ObjectId;
  isSeen: boolean;
}

export { notificationInterface };
