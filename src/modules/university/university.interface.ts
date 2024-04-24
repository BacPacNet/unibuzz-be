

interface Degree {
  degreeTitle: string;
  durationYears: number;
  description: string;
  requirements: string;
}

interface Course {
  name: string;
  degrees: Degree[];
}

interface Program {
  program: string;
  courses: Course[];
}

interface University {
  _id: string;
  id: string;
  name: string;
  score: string;
  city: string;
  country: string;
  collegePage?: string;
  tuitionFee?: string;
  undergraduatePrograms?: number;
  programs: Program[];
}


export {
    Degree,
    Course,
    Program,
    University,
   
  };