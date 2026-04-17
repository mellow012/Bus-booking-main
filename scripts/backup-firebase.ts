import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const sanitizePrivateKey = (key?: string): string | undefined => {
  if (!key) return undefined;
  return key
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/^["']/, '')
    .replace(/["',\s]+$/, '')
    .trim();
};

const privateKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase Admin environment variables.');
  process.exit(1);
}

const app = getApps().length === 0 
  ? initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  : getApps()[0];

const db = getFirestore(app);

const COLLECTIONS = [
  'users',
  'companies',
  'buses',
  'routes',
  'schedules',
  'bookings',
  'payments',
  'activityLogs',
  'auditLogs'
];

async function backup() {
  const backupDir = path.resolve('tmp/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join(backupDir, `backup-${timestamp}`);
  fs.mkdirSync(sessionDir);

  console.log(`Starting backup to ${sessionDir}...`);

  for (const collectionName of COLLECTIONS) {
    try {
      console.log(`Backing up collection: ${collectionName}...`);
      const snapshot = await db.collection(collectionName).get();
      
      if (snapshot.empty) {
        console.log(`Collection ${collectionName} is empty.`);
        continue;
      }

      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      const filePath = path.join(sessionDir, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Successfully backed up ${data.length} documents from ${collectionName}.`);
    } catch (error) {
      console.error(`Error backing up ${collectionName}:`, error);
    }
  }

  console.log('Backup process completed.');
}

backup().catch(console.error);
