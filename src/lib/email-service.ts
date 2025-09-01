import nodemailer from 'nodemailer';

// Create a single transporter instance
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendPasswordResetEmail(email: string, companyName: string, resetLink: string, companyId: string): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: `Complete Your ${companyName} Account Setup`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to BusBooking Platform!</h2>
        <p>Your company <strong>${companyName}</strong> has been created.</p>
        <p>Click below to set your password and complete setup:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Set Up Account
          </a>
        </div>
        <p><small>This link expires in 24 hours. Company ID: ${companyId}</small></p>
      </div>
    `,
  };

  try {
    console.time('Email Sending');
    console.log('Attempting to send email to:', email);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    console.timeEnd('Email Sending');
  } catch (error) {
    console.error('Failed to send email to', email, ':', error);
    throw new Error('Email sending failed');
  }
}