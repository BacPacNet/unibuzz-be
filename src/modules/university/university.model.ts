import { Schema, model } from 'mongoose';

// Define an interface for TypeScript
export interface IUniversity extends Document {
  name: string;
  address: string;
  city: string;
  email: string;
  longDescription: string;
  officeHours: string;
  phone: string;
  ranking: string;
  shortOverview: string;
  totalStudents: string;
  tuitionFee: string;
  campus: string;
  country: string;
  countryCode: string;
  domains: string[];
  logo: string;
  stateProvince?: string | null;
  webPages: string[];
}

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
  },
  { timestamps: true }
);

const UniversityModel = model<IUniversity>('university', UniversitySchema);

export default UniversityModel;
