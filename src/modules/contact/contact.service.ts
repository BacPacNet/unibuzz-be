import { sendEmail } from '../email/email.service';
import contactModal from './contact.modal';
import 'dotenv/config';

export const createContactMessage = async (
  email: string,
  firstName: string,
  lastName: string,
  university: string = '',
  message: string
) => {
  const data = {
    email,
    firstName,
    lastName,
    university,
    message,
  };

  if (!process.env['EMAIL_FROM']) {
    throw new Error('Missing EMAIL_FROM in environment variables');
  }

  const senderEmail: string = process.env['EMAIL_FROM'];

  await contactModal.create(data);

  await sendEmail(
    senderEmail,
    'New Contact Request from Unibuzz',
    '',
    `
        <p><strong>New Contact Request Received</strong></p>
      
        <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
         <p><strong>Email:</strong> ${data.email}</p>
        ${data.university ? `<p><strong>University:</strong> ${data.university}</p>` : ''}
        <p><strong>Message:</strong></p>
        <blockquote>${data.message}</blockquote>
      
        <p>Please respond to the user as soon as possible.</p>
      
        <br>
        <p>Best regards,</p>
        <p><strong>Unibuzz</strong> System Notification</p>
        `
  );
};
