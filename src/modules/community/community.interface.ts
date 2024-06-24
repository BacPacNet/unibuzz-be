interface communityInterface {
  communityCoverUrl: { imageUrl: String; publicId: String };
  communityLogoUrl: { imageUrl: String; publicId: String };
  name: string;
  adminId: string;
  numberOfUser: number;
  numberOfStudent: number;
  numberOfFaculty: number;
}

export { communityInterface };
