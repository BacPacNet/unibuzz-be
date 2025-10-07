import { Request, Response } from 'express';
import { loginEmailVerificationService } from '.';

export const createLoginEmailOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    await loginEmailVerificationService.createloginEmailVerificationOtp(email);
    return res.status(200).json({ message: 'created', isAvailable: true });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};

export const checkLoginEmailOtp = async (req: Request, res: Response) => {
  const { verificationOtp, email } = req.body;

  try {
    await loginEmailVerificationService.checkloginEmailVerificationOtp(verificationOtp, email);
    return res.status(200).json({ message: 'created', isAvailable: true });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};
export const checkLoginEmailOtpV2 = async (req: Request, res: Response) => {
  const { verificationOtp, email, universityId } = req.body;

  try {
    const isUniversityDomain = await loginEmailVerificationService.checkloginEmailVerificationOtpV2(
      verificationOtp,
      email,
      universityId
    );
    return res.status(200).json({ message: 'created', isAvailable: true, isUniversityDomain });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};
