import fetch from "node-fetch";

export const sendOtpEmail = async (to, otp) => {
  const text = `Your Joker Bingo OTP code is: ${otp}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f8f8;">
      <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
        <h2 style="color: #ff4081; text-align: center;">Joker Bingo OTP</h2>
        <p style="font-size: 18px;">Your OTP code is: <b>${otp}</b></p>
        <p style="font-size: 14px; color: #777;">This code expires in 10 minutes.</p>
      </div>
    </div>
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
