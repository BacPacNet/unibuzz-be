import mongoose from 'mongoose';

interface media {
  imageUrl: String;
  publicId: String;
}
interface reaction {
  userId: string;
  emoji: string;
}

type ObjectIdLike = string | mongoose.Types.ObjectId;

type MessageMedia = {
  imageUrl: string;
  publicId: string;
};

/** Shape of a single entry in UserProfile.blockedUsers when reading from DB */
export type BlockedUserEntry = { userId?: unknown } | null;

interface messageInterface {
  sender: mongoose.Types.ObjectId;
  senderProfile: mongoose.Types.ObjectId;
  content: string;
  chat: mongoose.Types.ObjectId;
  readByUsers: mongoose.Types.ObjectId[];
  media?: media[];
  reactions: reaction[];
  createdAt?: Date;
  updatedAt?: Date;
}

export { messageInterface, ObjectIdLike, MessageMedia };
