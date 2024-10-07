import mongoose from 'mongoose';

interface communityInterface {
  communityCoverUrl: { imageUrl: String; publicId: String };
  communityLogoUrl: { imageUrl: String; publicId: String };
  name: string;
  adminId: mongoose.Types.ObjectId;
  collegeID: mongoose.Types.ObjectId;
  numberOfUser: number;
  numberOfStudent: number;
  numberOfFaculty: number;
  about: string;
}

export { communityInterface };
