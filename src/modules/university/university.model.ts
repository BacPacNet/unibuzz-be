import { Schema, model } from 'mongoose';
import { College } from './university.interface';

const collogesSchema = new Schema<College>({
  name: { type: String, required: true },
  country: { type: String, required: true },
  wikiInfoBox: {
    type: Map,
    of: {
      type: String,
      set: (val: any) => val.toString(),
      get: (val: any) => val.toString(),
    },
  },
  collegeBoardInfo: {
    name: { type: String },
    Location: { type: String },
    PhoneNumber: { type: String },
    Website: { type: String },
  },
  topUniInfo: {
    name: { type: String },
    tuitionFee: { type: String, default: null },
    about: { type: String },
    studentsAndFacultiesData: [
      {
        TotalStudents: { type: String },
        UGStudents: { type: String },
        PGStudents: { type: String },
        InternationalStudents: { type: String },
        TotalFacultyStaff: { type: String },
        DomesticStaff: { type: String },
        IntlStaff: { type: String },
      },
    ],
    programs: [
      {
        name: { type: String },
        courses: [
          {
            name: { type: String },
            degrees: [String],
          },
        ],
      },
    ],
  },
  pathUrl: { type: String },
  isCommunityCreated: { type: Boolean, require: true, default: false },
  images: [String],
  logos: [String],
});

const UniversityModel = model<College>('colleges', collogesSchema);

export default UniversityModel;
