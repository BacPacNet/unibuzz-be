import mongoose from 'mongoose';

interface media {
  imageUrl: String;
  publicId: String;
}
interface chatInterface {
  chatName: string;
  isGroupChat: boolean;
  groupLogo: media;
  groupDescription: string;
  users: mongoose.Types.ObjectId[];
  latestMessage: mongoose.Types.ObjectId;
  groupAdmin: mongoose.Types.ObjectId;
  isBlock: boolean;
  isRequestAccepted: boolean;
}

export { chatInterface };
