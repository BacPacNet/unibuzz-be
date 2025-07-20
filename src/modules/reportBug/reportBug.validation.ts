import Joi from "joi";


export const bugReportSchema = Joi.object({
  description: Joi.string().max(500).required(),
  steps: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  // screenshot is handled by multer so we don’t validate it here
});

