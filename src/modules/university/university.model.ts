import { Schema, model } from 'mongoose';

// Define an interface for TypeScript
export interface IUniversity extends Document {
  _id: string;
  name: string;
  __v: string;
  accredited: string;
  address: string;
  application_deadline: string;
  average_monthly_cost_of_living: string;
  campus: string;
  campus_safety: string;
  career_services_availability: string;
  city: string;
  continent: string;
  country: string;
  country_code: string;
  domains: string[];
  email: string;
  'faculty_to_student ratio': { $numberDouble: string };
  international_programs: string;
  logo: string;
  long_description: string;
  maximum_scholarship_amount: string;
  office_hours: string;
  phone: string;
  ranking: string;
  religion_friendly: string;
  scholarship_availability: string;
  short_overview: string;
  start_date: string;
  state_province: any;
  student_housing_availability: string;
  total_students: { $numberInt: string };
  tuition_fee: string;
  type: string;
  web_pages: string[];
  communityId?: string;
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
    communityId: { type: String, required: false },
  },
  { timestamps: true }
);

const UniversityModel = model<IUniversity>('university', UniversitySchema);

export default UniversityModel;
