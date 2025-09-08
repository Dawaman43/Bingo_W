import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // smtp-relay.brevo.com
      port: process.env.SMTP_PORT, // 587
      secure: false, // Brevo uses STARTTLS (not SSL)
      auth: {
        user: process.env.SMTP_USER, // e.g., 94d9cb001@smtp-brevo.com
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Your App" <${process.env.SENDER_EMAIL}>`, // will appear as sender
      to,
      subject,
      text,
    });

    console.log("✅ Email sent successfully");
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
  }
};
