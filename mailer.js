const nodemailer = require("nodemailer");

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use Gmail App Password
  },
});

// Function to send welcome email
const sendWelcomeEmail = async (to, name) => {
  try {
    const mailOptions = {
      from: `"Your App Name" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: "Welcome to Our Platform 🎉",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #4CAF50;">Hello ${name},</h2>
          <p>Welcome to our platform! We're excited to have you onboard.</p>
          <p>Feel free to explore and let us know if you need any help.</p>
          <br/>
          <p>Best Regards,<br/><strong>Your Team</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Welcome email sent successfully");
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
  }
};

module.exports = sendWelcomeEmail;