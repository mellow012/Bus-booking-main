const admin = require('firebase-admin');
const serviceAccount = require('./src/lib/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = 'XvFIFk8TpKhIEN73aB38g1IfDjB3'; // Replace with your superadmin's UID
admin.auth().setCustomUserClaims(uid, { role: 'superadmin' })
  .then(() => console.log('Superadmin claim set'))
  .catch(error => console.error('Error setting claim:', error));