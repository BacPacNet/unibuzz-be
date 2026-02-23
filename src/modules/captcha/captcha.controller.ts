import { Request, Response } from 'express';
import httpStatus from 'http-status';
import * as captchaService from './captcha.service';
import catchAsync from '../utils/catchAsync';


  export const submitCaptcha = catchAsync(async (req: Request, res: Response) => {
    const token = req.body['g-recaptcha-response'] as string;
    const result = await captchaService.verifyCaptcha(token);

    if (result.success) {
      return res.status(httpStatus.OK).json({ message: 'Verification successful' });
    }

    return res.status(httpStatus.BAD_REQUEST).json({
      message: 'CAPTCHA failed',
      errors: result['error-codes'] ?? [],
    });

});
