export interface IEventPost {
  id: number;
  communityId: number;
  title: string;
  description: string;
  image: { imageUrl: String; publicId: String }; // Adjust as per the exact shape of your image object
  eventDateTime: Date;
  location: string;
  organizer: {
    name: string;
    contact?: string; // Optional
  };
  status: 'Draft' | 'Published' | 'Cancelled' | 'Completed';
  capacity?: number; // Optional
  attendees: number[]; // Array of user IDs
  tags: string[]; // Array of tags

  registrationRequired: boolean;
  registrationLink?: string; // Optional
  visibility: 'Public' | 'Private';
  createdAt?: Date; // Automatically added by Mongoose's timestamps
  updatedAt?: Date; // Automatically added by Mongoose's timestamps
}
