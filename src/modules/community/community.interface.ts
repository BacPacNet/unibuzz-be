import mongoose from 'mongoose';

interface User {
  id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  universityName: string;
  year: string;
  degree: string;
  major: string;
}

interface communityInterface {
  _id: mongoose.Types.ObjectId;
  communityCoverUrl: { imageUrl: String; publicId: String };
  communityLogoUrl: { imageUrl: String; publicId: String };
  name: string;
  adminId: mongoose.Types.ObjectId;
  collegeID: mongoose.Types.ObjectId;
  numberOfStudent: number;
  numberOfFaculty: number;
  about: string;
  users: User[];
  assistantId: string;
}

export { communityInterface };
