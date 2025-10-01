const nodemailer = require('nodemailer');

// Create transporter with direct SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify connection
transporter.verify(function (error, success) {
  if (error) {
    console.error('Email connection verification failed:', error);
  } else {
    console.log('Server is ready to send emails');
  }
});

// Interview email function
const sendInterviewEmail = async (toEmail, name, jobTitle, interviewDate, interviewLink) => {
  try {
    const mailOptions = {
      from: `"Job Matcher" <${process.env.EMAIL_USERNAME}>`,
      to: toEmail,
      subject: `Interview Scheduled for ${jobTitle}`,
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Interview Scheduled</h2>
                    <p>Hello ${name},</p>
                    <p>Your interview for <strong>${jobTitle}</strong> has been scheduled.</p>
                    <p><strong>Date & Time:</strong> ${new Date(interviewDate).toLocaleString()}</p>
                    <p><strong>Interview Link:</strong> <a href="${interviewLink}">${interviewLink}</a></p>
                    <p>Please join 5 minutes before your scheduled time.</p>
                    <p>Best regards,<br>The Hiring Team</p>
                </div>
            `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

const sendVerificationEmail = async (email, name, otp) => {
  try {
    const mailOptions = {
      from: `"Your App" <${process.env.EMAIL_USERNAME}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Email Verification</h2>
                    <p>Hello ${name},</p>
                    <p>Thank you for registering. Please use the following OTP to verify your email address:</p>
                    <div style="background: #f4f4f4; padding: 10px; margin: 20px 0; text-align: center; font-size: 24px; letter-spacing: 5px;">
                        ${otp}
                    </div>
                    <p>This OTP is valid for 15 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>Best regards,<br>Your App Team</p>
                </div>
            `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

const sendPasswordResetEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const message = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message
    };

    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
}


// Add this to your exports
module.exports = { sendInterviewEmail, sendVerificationEmail, sendPasswordResetEmail };