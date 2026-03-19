import { Document } from 'mongoose';


 interface IUniversity extends Document {
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


// Interface for WikiInfoBox
interface WikiInfoBox {
  [key: string]: string;
}

// Interface for CollegeBoardInfo
interface CollegeBoardInfo {
  name?: string;
  Location?: string;
  PhoneNumber?: string;
  Website?: string;
}

// Interface for StudentsAndFacultiesData
interface StudentsAndFacultiesData {
  TotalStudents?: string;
  UGStudents?: string;
  PGStudents?: string;
  InternationalStudents?: string;
  TotalFacultyStaff?: string;
  DomesticStaff?: string;
  IntlStaff?: string;
}

// Interface for Course
interface Course {
  name?: string;
  degrees?: string[];
}

// Interface for Program
interface Program {
  name?: string;
  courses?: Course[];
}

interface TopUniInfo {
  name?: string;
  tuitionFee?: string | null;
  about?: string;
  studentsAndFacultiesData?: StudentsAndFacultiesData[];
  programs?: Program[];
}

type SearchParamsType = {
  Search?: string;
  city?: string;
  country?: string;
  region?: string;
  type?: string;
};

// Interface for College
interface College extends Document {
  name: string;
  country: string;
  wikiInfoBox: WikiInfoBox;
  collegeBoardInfo?: CollegeBoardInfo;
  topUniInfo?: TopUniInfo;
  pathUrl?: string;
  isCommunityCreated: boolean;
  images?: string[];
  logos?: string[];
}

type UniversityPayload = Partial<IUniversity>;
type UniversityFilter = Record<string, unknown>;
 
export { College, SearchParamsType, UniversityPayload, UniversityFilter ,IUniversity};

