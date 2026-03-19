import { Schema, model } from 'mongoose';
import { IUniversity } from './university.interface';




const UniversitySchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    email: { type: String, required: true },
    long_description: { type: String, required: true },
    office_hours: { type: String, required: true },
    phone: { type: String, required: true },
    ranking: { type: String, required: true },
    short_overview: { type: String, required: true },
    total_students: { type: String, required: true },
    tuition_fee: { type: String, required: true },
    campus: { type: String, required: true },
    country: { type: String, required: true },
    country_code: { type: String, required: true },
    domains: { type: [String], required: true },
    logo: { type: String, required: true },
    state_province: { type: String, default: null },
    web_pages: { type: [String], required: true },
    communityId: { type: String, required: false },
  },
  { timestamps: true }
);

const UniversityModel = model<IUniversity>('university', UniversitySchema);

export default UniversityModel;
