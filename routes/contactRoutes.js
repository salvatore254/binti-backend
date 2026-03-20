// routes/contactRoutes.js
const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message, subject } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields (name, email, message)." });
    }

    // Create transport - using Gmail service as example
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: subject || `New enquiry from ${name}`,
      text: `
New enquiry from Binti website

Name: ${name}
Email: ${email}
Phone: ${phone || "N/A"}

Message:
${message}
      `,
      html: `
        <h3>New enquiry from Binti website</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <h4>Message:</h4>
        <p>${message}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Message sent: %s", info.messageId);
    return res.json({ success: true, message: "Message sent successfully." });
  } catch (err) {
    console.error("Error in contact route:", err);
    return res.status(500).json({ success: false, message: "Failed to send message." });
  }
});

module.exports = router;
