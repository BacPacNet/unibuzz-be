import { Request, Response } from 'express';

import { universityVerificationEmailService } from '../universityVerificationEmail';
import { findUniversityUsersAgg } from './universityUsers.service';

export const findUniversityUsersByUserDetails = async (req: Request, res: Response) => {
  const { email, name, dob, universityId } = req.body;

  if (universityId.toString().trim() === '') {
    return res.status(400).json({ message: 'University ID is required' });
  }

  const universityUsers = await findUniversityUsersAgg(email, universityId, name, dob);
  if (!universityUsers) {
    return res.status(200).json({ universityUsers, isDomainValid: false });
  }

  const isDomainValid = await universityVerificationEmailService.universityEmailDomainCheck(email, universityId);
  if (isDomainValid) {
    return res.status(200).json({ message: 'User is university user', isDomainValid });
  }

  return res.status(200).json({ message: 'User not found', isDomainValid: false });
};
