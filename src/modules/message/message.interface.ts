import mongoose from 'mongoose';

interface media {
  imageUrl: String;
  publicId: String;
}

interface messageInterface {
  sender: mongoose.Types.ObjectId;
  senderProfile: mongoose.Types.ObjectId;
  content: string;
  chat: mongoose.Types.ObjectId;
  readByUsers: mongoose.Types.ObjectId[];
  media?: media[];
}

export { messageInterface };
