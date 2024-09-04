import mongoose from 'mongoose';

interface media {
  imageUrl: String;
  publicId: String;
}

interface users {
  userId: mongoose.Types.ObjectId;
  isRequestAccepted: boolean;
}
interface chatInterface {
  chatName: string;
  isGroupChat: boolean;
  groupLogo: media;
  groupDescription: string;
  users: users[];
  latestMessage: mongoose.Types.ObjectId;
  groupAdmin: mongoose.Types.ObjectId;
  isBlock: boolean;
  isRequestAccepted: boolean;
}

export { chatInterface };
