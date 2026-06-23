import 'dotenv/config';
import { Resend } from 'resend';

async function main() {
  const apiKey = (process.env.RESEND_API_KEY || process.env.resend_apikey || '').trim();
  console.log('Using Resend API Key:', apiKey);
  const resend = new Resend(apiKey);

  try {
    console.log('Sending email using default onboarding domain...');
    const result1 = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'francismitawa406@gmail.com',
      subject: 'Test Onboarding',
      html: '<p>Test onboarding</p>'
    });
    console.log('Onboarding send result:', result1);
  } catch (error) {
    console.error('Onboarding send error:', error);
  }

  try {
    console.log('Sending email using tibhukebus.com domain...');
    const result2 = await resend.emails.send({
      from: 'TibhukeBus <admin@tibhukebus.com>',
      to: 'francismitawa406@gmail.com',
      subject: 'Test Custom Domain',
      html: '<p>Test custom domain</p>'
    });
    console.log('Custom domain send result:', result2);
  } catch (error) {
    console.error('Custom domain send error:', error);
  }
}

main().catch(console.error);
