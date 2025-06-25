export interface CreateBugReportDTO {
  description: string;
  steps?: string | undefined;
  email?: string | undefined;
  screenshotUrl?: string | null | undefined;
}


export interface IBugReport extends Document {
  description: string
  steps?: string
  email?: string
  screenshotUrl?: string
  createdAt: Date
  updatedAt: Date
}