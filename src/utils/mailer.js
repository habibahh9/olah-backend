const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (toEmail, otp) => {
  await transporter.sendMail({
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
};

module.exports = { sendOtpEmail };