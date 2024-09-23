import { Request, Response } from 'express';
import { universityVerificationEmailService } from '.';

export const createUniversityEmailOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    await universityVerificationEmailService.createUniversityEmailVerificationOtp(email);
    return res.status(200).json({ message: 'created', isAvailable: true });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};

export const checkUniversityEmailOtp = async (req: Request, res: Response) => {
  const { UniversityOtp, universityEmail } = req.body;

  try {
    await universityVerificationEmailService.checkUniversityEmailVerificationOtp(UniversityOtp, universityEmail);
    return res.status(200).json({ message: 'created', isAvailable: true });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};
