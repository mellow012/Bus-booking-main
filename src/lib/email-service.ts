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
export async function sendOperatorInviteEmail(
  email: string,
  operatorName: string,
  companyName: string,
  inviteLink: string,
  operatorId: string
): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: `You've been invited to join ${companyName} as an Operator`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">BusBooking Platform</h1>
          <p style="color: #64748b; margin-top: 5px;">Operator Invitation</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${operatorName}!</h2>
          <p style="color: #475569; line-height: 1.6;">
            You've been invited to join <strong>${companyName}</strong> as an <strong>Operator</strong>.
          </p>
          <p style="color: #475569; line-height: 1.6;">
            In this role, you'll be able to create and manage schedules, handle bookings, and support daily operations for your company.
          </p>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${inviteLink}" 
             style="background-color: #2563eb; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: 600; font-size: 16px;">
            Complete Your Registration
          </a>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 5px; margin-bottom: 30px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Important:</strong> This invitation link expires in 24 hours. 
            Please complete registration as soon as possible.
          </p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px;">
          <p style="color: #64748b; font-size: 12px; margin: 5px 0;">
            Operator ID: ${operatorId}
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 15px;">
            If you weren't expecting this email, please ignore it or contact support.
          </p>
        </div>
      </div>
    `,
  };

  try {
    console.time('Operator Invite Email');
    console.log('Sending invite to:', email);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    console.timeEnd('Operator Invite Email');
  } catch (error) {
    console.error('Failed to send operator invite to', email, ':', error);
    throw new Error('Failed to send invitation email');
  }
}