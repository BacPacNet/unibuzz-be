import { Schema, model } from 'mongoose';
import { College } from './university.interface';

// const UniversitySchema = new Schema<University>({
//   id: { type: String, required: true },
//   name: { type: String, required: true },
//   score: { type: String, required: true },
//   city: { type: String, required: true },
//   country: { type: String, required: true },
//   collegePage: { type: String },
//   tuitionFee: { type: String },
//   undergraduatePrograms: { type: Number },
//   programs: [
//     {
//       program: { type: String, required: true },
//       courses: [
//         {
//           name: { type: String, required: true },
//           degrees: [
//             {
//               degreeTitle: { type: String, required: true },
//               durationYears: { type: Number, required: true },
//               description: { type: String, required: true },
//               requirements: { type: String, required: true },
//             },
//           ],
//         },
//       ],
//     },
//   ],
// });

// wikiInfoBox: {
//   Motto: { type: String },
//   MottoInEnglish: { type: String },
//   Type: { type: String },
//   Established: { type: String },
//   AcademicAffiliations: { type: String },
//   Endowment: { type: String },
//   Chancellor: { type: String },
//   President: { type: String },
//   Provost: { type: String },
//   AcademicStaff: { type: String },
//   AdministrativeStaff: { type: String },
//   Students: { type: String },
//   Undergraduates: { type: String },
//   Postgraduates: { type: String },
//   Location: { type: String },
//   Campus: { type: String },
//   Colours: { type: String },
//   Nickname: { type: String },
//   SportingAffiliations: { type: String },
//   Mascot: { type: String },
//   Website: { type: String }
// },

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

// const UniversityModel = model<University>('University', UniversitySchema);
const UniversityModel = model<College>('colleges', collogesSchema);

export default UniversityModel;
