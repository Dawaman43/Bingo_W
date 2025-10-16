import fetch from "node-fetch";

export const sendEmail = async (to, otp) => {
  const text = `Your Joker Bingo OTP code is: ${otp}`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Joker Bingo OTP</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ff4081, #f50057); padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">🎉 Joker Bingo</h1>
          <p style="margin: 5px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">One-Time Password</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #ff4081; text-align: center; margin-bottom: 30px; font-size: 24px;">Your Verification Code</h2>
          
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #ff4081, #f50057); color: #ffffff; padding: 20px 40px; border-radius: 10px; font-size: 32px; font-weight: bold; letter-spacing: 4px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); box-shadow: 0 4px 12px rgba(255, 64, 129, 0.3);">
              ${otp}
            </div>
          </div>
          
          <p style="text-align: center; font-size: 16px; color: #555; margin-bottom: 10px;">
            Use this code to verify your account.
          </p>
          
          <p style="text-align: center; font-size: 14px; color: #888; margin-bottom: 0;">
            This code expires in <strong>10 minutes</strong>. Don't share it with anyone.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            &copy; 2025 Joker Bingo. All rights reserved. | <a href="#" style="color: #ff4081; text-decoration: none;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Joker Bingo", email: process.env.SENDER_EMAIL },
        to: [{ email: to }],
        subject: "Your Joker Bingo OTP Code",
        textContent: text,
        htmlContent: html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to send OTP email");
    console.log("✅ OTP email sent:", data);
    return data;
  } catch (err) {
    console.error("❌ Error sending OTP email:", err);
    throw err;
  }
};
