const nodemailer = require("nodemailer");

// Log konfigurasi email saat startup (tanpa menampilkan password)
console.log("[Mailer] EMAIL_USER:", process.env.EMAIL_USER ? `${process.env.EMAIL_USER.slice(0, 4)}****` : "❌ TIDAK DISET");
console.log("[Mailer] EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Diset" : "❌ TIDAK DISET");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const info = await transporter.sendMail({
      from: `"Olah App" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Kode OTP Ubah Kata Sandi",
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:auto">
          <h2 style="color:#d06224">Kode OTP Anda</h2>
          <p>Gunakan kode berikut untuk mengubah kata sandi:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#d06224;margin:20px 0">
            ${otp}
          </div>
          <p style="color:#888">Kode berlaku selama <strong>5 menit</strong>.</p>
          <p style="color:#888">Abaikan email ini jika Anda tidak meminta perubahan.</p>
        </div>
      `,
    });
    console.log("[Mailer] Email OTP berhasil dikirim ke:", toEmail, "| MessageId:", info.messageId);
  } catch (error) {
    console.error("[Mailer] ❌ Gagal mengirim email OTP ke:", toEmail);
    console.error("[Mailer] Error code:", error.code);
    console.error("[Mailer] Error message:", error.message);
    throw error; // re-throw agar controller bisa handle
  }
};

module.exports = { sendOtpEmail };