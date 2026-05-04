import { logger } from '../../modules/logger';
import { emailService } from '../../modules/email';

export const handleInstitutionalAccountCreatedEmail = async (job: any) => {
  try {
    const { email, firstName, userStatus, temporaryPassword } = job;

    if (!email) {
      throw new Error('Missing required field: email');
    }

    await emailService.sendInstitutionalAccountCreatedEmail(
      email,
      firstName || 'User',
      userStatus || 'student',
      temporaryPassword || ''
    );

    logger.info('✅ Institutional account created email sent', { email });

    // Keep _id for current worker success check.
    return { _id: `institutional-email-${email}` };
  } catch (error) {
    logger.error('Error in handleInstitutionalAccountCreatedEmail:', error);
    throw error;
  }
};
