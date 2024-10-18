import mongoose from 'mongoose';

interface media {
  imageUrl: String;
  publicId: String;
}

interface users {
  userId: mongoose.Types.ObjectId;
  isRequestAccepted: boolean;
  isStarred: boolean;
}
interface Message {
  _id: string;
  chat: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sender: mongoose.Types.ObjectId;
  readByUsers: mongoose.Types.ObjectId[];

}

interface chatInterface {
  chatName: string;
  isGroupChat: boolean;
  groupLogo: media;
  groupDescription: string;
  users: users[];
  blockedBy: mongoose.Types.ObjectId[];
  latestMessage: mongoose.Types.ObjectId | Message;
  groupAdmin: mongoose.Types.ObjectId;
  isBlock: boolean;
  isRequestAccepted: boolean;
}

export { chatInterface };
