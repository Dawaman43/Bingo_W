import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, // STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection
    await transporter.verify();
    console.log("✅ SMTP ready");

    // Send email with HTML styling
    const info = await transporter.sendMail({
      from: `"Joker Bingo" <${process.env.SENDER_EMAIL}>`, // Cool sender name
      to,
      subject,
      text, // fallback text for email clients that don’t support HTML
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.5; padding: 20px; background-color: #f8f8f8;">
          <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="background-color: #ff4081; color: white; text-align: center; padding: 20px;">
              <h1 style="margin: 0; font-size: 28px;">Joker Bingo</h1>
            </div>
            <div style="padding: 20px;">
              <p>${text}</p>
              <p style="margin-top: 20px; color: #777;">Good luck & have fun! 🎉</p>
            </div>
            <div style="background-color: #f1f1f1; padding: 10px; text-align: center; font-size: 12px; color: #999;">
              &copy; ${new Date().getFullYear()} Joker Bingo. All rights reserved.
            </div>
          </div>
        </div>
      `,
    });

    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ Error sending email:", err);
  }
};
