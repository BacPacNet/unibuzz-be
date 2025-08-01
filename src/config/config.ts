import Joi from 'joi';
import dotenv from 'dotenv';
dotenv.config();

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which verify email token expires'),
    SMTP_HOST: Joi.string().description('server that will send the emails'),
    SMTP_PORT: Joi.number().description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    CLIENT_URL: Joi.string().required().description('Client url'),
    OPENAI_API_KEY: Joi.string().required().description('Open AI API key'),
    // Redis configuration for BullMQ
    REDIS_HOST: Joi.string().required().description('Redis host'),
    REDIS_PORT: Joi.number().default(6379).description('Redis port'),
    REDIS_PASSWORD: Joi.string().optional().description('Redis password'),
    // Firebase Configuration
    // AWS Configuration
    AWS_ACCESS_KEY_ID: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }).description('AWS Access Key ID'),
    AWS_SECRET_ACCESS_KEY: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }).description('AWS Secret Access Key'),
    AWS_REGION: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }).description('AWS Region'),
    AWS_S3_BUCKET_NAME: Joi.string().when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }).description('AWS S3 Bucket Name'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}
const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
    cookieOptions: {
      httpOnly: true,
      secure: envVars.NODE_ENV === 'production',
      signed: true,
    },
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  clientUrl: envVars.CLIENT_URL,
  OPENAI_API_KEY: envVars.OPENAI_API_KEY,
  bull_mq_queue: {
    REDIS_HOST: envVars.REDIS_HOST,
    REDIS_PORT: envVars.REDIS_PORT,
    REDIS_PASSWORD: envVars.REDIS_PASSWORD,
  },
  aws: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    region: envVars.AWS_REGION,
    s3BucketName: envVars.AWS_S3_BUCKET_NAME,
  },
  fcm: {
    config: envVars.FIREBASE_CONFIG,
  },
};

export default config;
