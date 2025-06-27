import { Document } from 'mongoose';
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
export { College, SearchParamsType };

