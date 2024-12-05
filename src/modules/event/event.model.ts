import mongoose, { model } from 'mongoose';
import { IEventPost } from './event.interface';

const eventPostSchema = new mongoose.Schema(
  {
    communityId: { type: String, required: true, ref: 'Community' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    image: { type: { imageUrl: String, publicId: String }, required: true },
    eventDateTime: { type: Date, required: true },
    location: { type: String, required: true },
    organizer: {
      name: { type: String, required: true },
      contact: { type: String, required: false },
    },
    status: { type: String, enum: ['Draft', 'Published', 'Cancelled', 'Completed'], default: 'Draft' },
    capacity: { type: Number, required: false },
    attendees: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    registrationRequired: { type: Boolean, default: false },
    registrationLink: {
      type: String,
      default: null,
    },
    visibility: { type: String, enum: ['Public', 'Private'], default: 'Public' },
  },
  {
    timestamps: true,
  }
);
const EventPostModel = model<IEventPost>('EventPost', eventPostSchema);

export default EventPostModel;
