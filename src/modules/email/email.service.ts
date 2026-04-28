import nodemailer from 'nodemailer';
import config from '../../config/config';
import logger from '../logger/logger';
import { Message } from './email.interfaces';

export const transport = nodemailer.createTransport(config.email.smtp);
/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'));
}

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @returns {Promise<void>}
 */
export const sendEmail = async (to: string, subject: string, text: string, html: string): Promise<void> => {
  const msg: Message = {
    from: config.email.from,
    to,
    subject,
    text,
    html,
  };
  await transport.sendMail(msg);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise<void>}
 */
export const sendResetPasswordEmail = async (to: string, token: string): Promise<void> => {
  const subject = 'Reset password';
  // replace this url with the link to the reset password page of your front-end app
  const resetPasswordUrl = `http://${config.clientUrl}/reset-password?token=${token}`;
  const text = `Hi,
  To reset your password, click on this link: ${resetPasswordUrl}
  If you did not request any password resets, then ignore this email.`;
  const html = `<div style="margin:30px; padding:30px; border:1px solid black; border-radius: 20px 10px;"><h4><strong>Dear user,</strong></h4>
  <p>To reset your password, click on this link: ${resetPasswordUrl}</p>
  <p>If you did not request any password resets, please ignore this email.</p>
  <p>Thanks,</p>
  <p><strong>Team</strong></p></div>`;
  await sendEmail(to, subject, text, html);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @param {string} name
 * @returns {Promise<void>}
 */
export const sendVerificationEmail = async (to: string, token: string, name: string): Promise<void> => {
  const subject = 'Email Verification';
  // replace this url with the link to the email verification page of your front-end app
  const verificationEmailUrl = `http://${config.clientUrl}/verify-email?token=${token}`;
  const text = `Hi ${name},
  To verify your email, click on this link: ${verificationEmailUrl}
  If you did not create an account, then ignore this email.`;
  const html = `<div style="margin:30px; padding:30px; border:1px solid black; border-radius: 20px 10px;"><h4><strong>Hi ${name},</strong></h4>
  <p>To verify your email, click on this link: ${verificationEmailUrl}</p>
  <p>If you did not create an account, then ignore this email.</p></div>`;
  await sendEmail(to, subject, text, html);
};

/**
 * Send email verification after registration
 * @param {string} to
 * @param {string} token
 * @param {string} name
 * @returns {Promise<void>}
 */
export const sendSuccessfulRegistration = async (to: string, token: string, name: string): Promise<void> => {
  const subject = 'Email Verification';
  // replace this url with the link to the email verification page of your front-end app
  const verificationEmailUrl = `http://${config.clientUrl}/verify-email?token=${token}`;
  const text = `Hi ${name},
  Congratulations! Your account has been created. 
  You are almost there. Complete the final step by verifying your email at: ${verificationEmailUrl}
  Don't hesitate to contact us if you face any problems
  Regards,
  Team`;
  const html = `<div style="margin:30px; padding:30px; border:1px solid black; border-radius: 20px 10px;"><h4><strong>Hi ${name},</strong></h4>
  <p>Congratulations! Your account has been created.</p>
  <p>You are almost there. Complete the final step by verifying your email at: ${verificationEmailUrl}</p>
  <p>Don't hesitate to contact us if you face any problems</p>
  <p>Regards,</p>
  <p><strong>Team</strong></p></div>`;
  await sendEmail(to, subject, text, html);
};

/**
 * Send email verification after registration
 * @param {string} to
 * @param {string} name
 * @returns {Promise<void>}
 */
export const sendAccountCreated = async (to: string, name: string): Promise<void> => {
  const subject = 'Account Created Successfully';
  // replace this url with the link to the email verification page of your front-end app
  const loginUrl = `http://${config.clientUrl}/auth/login`;
  const text = `Hi ${name},
  Congratulations! Your account has been created successfully. 
  You can now login at: ${loginUrl}
  Don't hesitate to contact us if you face any problems
  Regards,
  Team`;
  const html = `<div style="margin:30px; padding:30px; border:1px solid black; border-radius: 20px 10px;"><h4><strong>Hi ${name},</strong></h4>
  <p>Congratulations! Your account has been created successfully.</p>
  <p>You can now login at: ${loginUrl}</p>
  <p>Don't hesitate to contact us if you face any problems</p>
  <p>Regards,</p>
  <p><strong>Team</strong></p></div>`;
  await sendEmail(to, subject, text, html);
};

/**
 * Send institutional account creation email with temporary credentials.
 * @param {string} to
 * @param {string} firstName
 * @param {string} userStatus
 * @param {string} temporaryPassword
 * @returns {Promise<void>}
 */
export const sendInstitutionalAccountCreatedEmail = async (
  to: string,
  firstName: string,
  userStatus: string,
  temporaryPassword: string
): Promise<void> => {
  const subject = 'Your Unibuzz Account Has Been Created';
  const normalizedStatus = (userStatus || 'student').toLowerCase();
  const loginUrl = 'https://unibuzz.org/login';
  const appStoreUrl = 'https://apps.apple.com/us/app/unibuzz-app/id6751199821';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.unibuzzapp&hl=en-US';
  const safeFirstName = firstName || 'User';
  const safePassword = temporaryPassword || 'Please contact your university administrator';

  const text = `Dear ${safeFirstName},

As part of your university's initiative to streamline campus communication and collaboration, an official ${normalizedStatus} account has been created for you on Unibuzz at the request of your institution.

Unibuzz serves as a centralized and verified platform for academic discussions, official updates, and campus engagement.

Login Credentials
Email: ${to}
Temporary Password: ${safePassword}

You may access your account using the following link:
${loginUrl}

Access via Mobile App
Download on iOS: ${appStoreUrl}
Download on Android: ${playStoreUrl}

Important
Please change your password after your first login from Settings.

For any assistance, please contact your university or use the Feedback Form on Unibuzz.

Yours sincerely,
Team Unibuzz`;

  const html = `<div style="margin:30px; padding:30px; border:1px solid #e5e7eb; border-radius:12px; font-family: Arial, sans-serif; line-height:1.6; font-size:15px;">
  <p>Dear ${safeFirstName},</p>
  <p>
    As part of your university's initiative to streamline campus communication and collaboration, an official
    <strong>${normalizedStatus}</strong> account has been created for you on Unibuzz at the request of your institution.
  </p>
  <p>
    Unibuzz serves as a centralized and verified platform for academic discussions, official updates, and campus engagement.
  </p>
  <h4 style="margin:16px 0 8px; font-size:18px;">Login Credentials</h4>
  <p style="margin:0;"><strong>Email:</strong> ${to}</p>
  <p style="margin:0 0 16px 0;"><strong>Temporary Password:</strong> ${safePassword}</p>
  <p>
    You may access your account using the following link:<br />
    <a href="${loginUrl}">${loginUrl}</a>
  </p>
  <h4 style="margin:16px 0 8px; font-size:18px;">Access via Mobile App</h4>
  <p style="margin:0;">
    Download on iOS: <a href="${appStoreUrl}">${appStoreUrl}</a>
  </p>
  <p style="margin:0 0 16px 0;">
    Download on Android: <a href="${playStoreUrl}">${playStoreUrl}</a>
  </p>
  <h4 style="margin:16px 0 8px; font-size:18px;">Important</h4>
  <p>Please change your password after your first login from Settings.</p>
  <p>For any assistance, please contact your university or use the Feedback Form on Unibuzz.</p>
  <p style="margin-top:24px;">Yours sincerely,<br /><strong>Team Unibuzz</strong></p>
</div>`;

  await sendEmail(to, subject, text, html);
};
