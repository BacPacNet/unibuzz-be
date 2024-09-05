interface ProfileImage {
  imageUrl: string;
  publicId: string;
}

interface UserProfile {
  _id: string;
  profile_dp: ProfileImage;
}

interface Sender {
  firstName: string;
  lastName: string;
  id: string;
}

interface usersInCHat {
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

interface Chat {
  _id: string;
  users: usersInCHat[];
}

interface media {
  imageUrl: string;
  publicId: string;
}

export type Reaction = {
  userId: string;
  emoji: string;
};

export interface Message {
  _id: string;
  sender: Sender;
  senderProfile: UserProfile;
  content: string;
  chat: Chat;
  readByUsers: string[];
  media: media[];
  createdAt: string;
  updatedAt: string;
  __v: number;
  reactions?: Reaction[];
}

export interface ReactedMessage {
  message: Message;
  sender: string;
}
