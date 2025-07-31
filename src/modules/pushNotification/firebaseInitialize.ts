import admin from 'firebase-admin';
import config from '../../config/config';

const serviceAccount = JSON.parse(Buffer.from(config.fcm.config, 'base64').toString('utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export default admin;
