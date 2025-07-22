import admin from 'firebase-admin';
import serviceAccount from './unibuzz-2024-firebase-adminsdk.json' assert { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export default admin;
