import { ContentType, CreateReportContentDTO, ReportStatus, SendReportContentEmailDTO } from './reportContent.interface';
import ReportContentModel from './reportContent.modal';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import httpStatus from 'http-status';
import { sendEmail } from '../email/email.service';

export const createReportContent = async (data: CreateReportContentDTO) => {
  if (!mongoose.Types.ObjectId.isValid(data.reporterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid reporter ID');
  }

  const newReport = new ReportContentModel({
    reporterId: new mongoose.Types.ObjectId(data.reporterId),
    contentType: data.contentType,
    description: data.description,
    userPostId: data.userPostId ? new mongoose.Types.ObjectId(data.userPostId) : null,
    communityPostId: data.communityPostId ? new mongoose.Types.ObjectId(data.communityPostId) : null,
    userPostCommentId: data.userPostCommentId ? new mongoose.Types.ObjectId(data.userPostCommentId) : null,
    userPostReplyId: data.userPostReplyId ? new mongoose.Types.ObjectId(data.userPostReplyId) : null,
    communityPostCommentId: data.communityPostCommentId ? new mongoose.Types.ObjectId(data.communityPostCommentId) : null,
    communityPostReplyId: data.communityPostReplyId ? new mongoose.Types.ObjectId(data.communityPostReplyId) : null,
  });

  const savedReport = await newReport.save();
  await sendReportContentEmail(
    data.reporterId,
    data.contentType,
    data.description,
    ReportStatus.PENDING,
    data.userPostId,
    data.communityPostId,
    data.userPostCommentId,
    data.userPostReplyId,
    data.communityPostCommentId,
    data.communityPostReplyId
  );
  return savedReport;
};

export const buildReportContentEmail = ({
  reporterId,
  contentType,
  description,
  status,
  userPostId,
  communityPostId,
  userPostCommentId,
  userPostReplyId,
  communityPostCommentId,
  communityPostReplyId,
}: SendReportContentEmailDTO) => {
  return `
      <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #222;">
  
        <h2 style="margin-bottom: 8px;">⚠️ Content Report Received</h2>
        <p style="color:#555;">A user has submitted a new report. Review details below.</p>
  
        <hr style="margin: 18px 0;">
  
        <h3 style="margin-bottom: 6px;">📌 Report Summary</h3>
        <p><strong>Reporter ID:</strong> ${reporterId}</p>
        <p><strong>Content Type:</strong> ${contentType}</p>
        ${status ? `<p><strong>Status:</strong> ${status}</p>` : ''}
  
        <hr style="margin: 18px 0;">
  
        <h3 style="margin-bottom: 6px;">🧷 Affected Content</h3>
        ${userPostId ? `<p><strong>User Post:</strong> ${userPostId}</p>` : ''}
        ${communityPostId ? `<p><strong>Community Post:</strong> ${communityPostId}</p>` : ''}
        ${userPostCommentId ? `<p><strong>User Comment:</strong> ${userPostCommentId}</p>` : ''}
        ${userPostReplyId ? `<p><strong>User Reply:</strong> ${userPostReplyId}</p>` : ''}
        ${communityPostCommentId ? `<p><strong>Community Comment:</strong> ${communityPostCommentId}</p>` : ''}
        ${communityPostReplyId ? `<p><strong>Community Reply:</strong> ${communityPostReplyId}</p>` : ''}
  
        ${
          !(
            userPostId ||
            communityPostId ||
            userPostCommentId ||
            userPostReplyId ||
            communityPostCommentId ||
            communityPostReplyId
          )
            ? `<p style="color:#888;">No content reference IDs were provided.</p>`
            : ''
        }
  
        <hr style="margin: 18px 0;">
  
        <h3 style="margin-bottom: 6px;">📝 Report Description</h3>
        <blockquote style="
          background:#f8f8f8;
          padding:12px 16px;
          border-left:4px solid #c62828;
          border-radius:4px;
          color:#333;
        ">
          ${description}
        </blockquote>
  
        <br>
  
        <p>You can review this report in the admin dashboard.</p>
  
        <p style="margin-top: 20px; font-weight:bold;">Unibuzz • Admin Notification</p>
      </div>
    `;
};

export const sendReportContentEmail = async (
  reporterId: string,
  contentType: ContentType,
  description: string,
  status: ReportStatus,
  userPostId: string = '',
  communityPostId: string = '',
  userPostCommentId: string = '',
  userPostReplyId: string = '',
  communityPostCommentId: string = '',
  communityPostReplyId: string = ''
) => {
  //   const senderEmail = 'aamil.shafi13@gmail.com';
  const senderEmail: string = process.env['EMAIL_FROM'] || '';
  if (!senderEmail) {
    throw new Error('Missing EMAIL_FROM in environment variables');
  }
  const html = buildReportContentEmail({
    reporterId: reporterId,
    contentType: contentType,
    description: description,
    status: status,
    userPostId: userPostId,
    communityPostId: communityPostId,
    userPostCommentId: userPostCommentId,
    userPostReplyId: userPostReplyId,
    communityPostCommentId: communityPostCommentId,
    communityPostReplyId: communityPostReplyId,
  });

  await sendEmail(senderEmail, 'New Content Report — Unibuzz', '', html);
};
