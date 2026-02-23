import config from '../../config/config';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export interface RecaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}




export const verifyCaptcha = async (
  token: string
): Promise<RecaptchaVerifyResponse> => {
  const secret = config.recaptchaSecretKey;

  if (!secret) {
    throw new Error('RECAPTCHA_SECRET_KEY is not configured');
  }

  const response = await fetch(RECAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret,
      response: token,
    }).toString(),
  });

  const data = (await response.json()) as RecaptchaVerifyResponse;


  return data;
};
