import 'dotenv/config';
import { Resend } from 'resend';

async function checkResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || process.env.resend_apikey?.trim();
  console.log('API Key loaded:', apiKey ? apiKey.substring(0, 8) + '...' : 'None');

  if (!apiKey) {
    console.error('No API key found in .env');
    return;
  }

  const resend = new Resend(apiKey);
  
  // Resend doesn't have a simple 'ping' endpoint, but we can try fetching domains
  // If the key is invalid, this should fail with a 401 or similar.
  try {
    const { data, error } = await resend.apiKeys.list();
    if (error) {
      console.error('Error verifying Resend API Key:', error.message);
    } else {
      console.log('Resend API key is VALID and active!');
    }
  } catch (err: any) {
    console.error('Exception checking Resend API key:', err.message);
  }
}

checkResend();
