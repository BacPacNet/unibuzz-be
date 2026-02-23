import Joi from 'joi';

export const verifyCaptchaSchema = {
  body: Joi.object({
    'g-recaptcha-response': Joi.string().required().messages({
      'string.empty': 'CAPTCHA response is required',
    }),
  }),
};
