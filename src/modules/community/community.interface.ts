import mongoose from 'mongoose';

interface User {
  id: mongoose.Types.ObjectId;
}

interface communityInterface {
  _id: mongoose.Types.ObjectId;
  communityCoverUrl: { imageUrl: String; publicId: String };
  communityLogoUrl: { imageUrl: String; publicId: String };
  name: string;
  adminId: mongoose.Types.ObjectId;
  collegeID: mongoose.Types.ObjectId;
  numberOfUser: number;
  numberOfStudent: number;
  numberOfFaculty: number;
  about: string;
  users: User[];
}

export { communityInterface };
