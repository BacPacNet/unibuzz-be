import { Schema, model } from 'mongoose'
import { IBugReport } from './reportBug.interface'

/**
 * Mongoose Document type for a Bug Report.
 */


const BugReportSchema = new Schema<IBugReport>(
  {
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    steps: {
      type: String,
    },
    email: {
      type: String,
      match: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/, // same as JOI
    },
    screenshotUrl: {
      type: String,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
)

const BugReportModel = model<IBugReport>('BugReport', BugReportSchema)

export default BugReportModel
