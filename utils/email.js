const nodemailer = require('nodemailer');

// Use Ethereal.email for development testing (free fake SMTP)
const isDevelopment = process.env.NODE_ENV !== 'production';
const useEthereal = isDevelopment && !process.env.EMAIL_USER;

let transporter;

if (useEthereal) {
  // Create test account automatically
  (async function() {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  })();
} else {
  // Use real SMTP configuration
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

async function sendInterviewEmail(to, name, jobTitle, interviewDate, interviewLink) {
  try {
    const mailOptions = {
      from: `"CareerConnect" <${process.env.EMAIL_USER || 'noreply@careerconnect.com'}>`,
      to,
      subject: `Interview Scheduled for ${jobTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Interview Scheduled</h2>
          <p>Dear ${name},</p>
          <p>Congratulations! You've been selected for an interview for the position:</p>
          <p><strong>${jobTitle}</strong></p>
          
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Interview Date:</strong> ${new Date(interviewDate).toLocaleString()}</p>
            <p><strong>Interview Link:</strong> <a href="${interviewLink}">${interviewLink}</a></p>
          </div>
          
          <p>Please join the meeting 5 minutes before the scheduled time.</p>
          <p>Best regards,<br>CareerConnect Recruitment Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (useEthereal) {
      console.log('📨 Email sent to Ethereal:', nodemailer.getTestMessageUrl(info));
    } else {
      console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw new Error('Failed to send email');
  }
}

module.exports = { sendInterviewEmail };