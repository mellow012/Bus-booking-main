import { db } from '@/lib/firebaseConfig';
import { addDoc, collection } from 'firebase/firestore';

export async function sendNotification({
  userId,
  type,
  title,
  message,
  data = {},
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: object;
}) {
  await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    title,
    message,
    data,
    isRead: false,
    createdAt: new Date(),
  });
}