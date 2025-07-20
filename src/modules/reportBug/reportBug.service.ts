import { sendEmail } from "../email/email.service";
import { CreateBugReportDTO, IBugReport } from "./reportBug.interface";
import BugReportModel from "./reportBug.model";

export const createBugReport = async (data: CreateBugReportDTO): Promise<IBugReport> => {
  const newReport = new BugReportModel(data)
  const savedReport = await newReport.save()

  const senderEmail = process.env['EMAIL_FROM']
  if (!senderEmail) {
    throw new Error('Missing EMAIL_FROM in environment variables')
  }

  // Email body
  const html = `
    <p><strong>New Bug Report Submitted</strong></p>

    ${data.email ? `<p><strong>Reporter Email:</strong> ${data.email}</p>` : ''}
    <p><strong>Description:</strong></p>
    <blockquote>${data.description}</blockquote>
    
    ${data.steps ? `<p><strong>Steps to Reproduce:</strong></p><blockquote>${data.steps}</blockquote>` : ''}
    ${
      data.screenshotUrl
        ? `<p><strong>Screenshot:</strong></p><img src="${data.screenshotUrl}" alt="Screenshot" style="max-width: 400px; border-radius: 8px;" />`
        : ''
    }

    <br>
    <p>Check the dashboard or database for more info.</p>
    <p><strong>Unibuzz</strong> System Notification</p>
  `

  await sendEmail(senderEmail, 'New Bug Report from Unibuzz', '', html)

  return savedReport
}
