// routes/contactRoutes.js
const express = require("express");
const router = express.Router();
const EmailService = require("../services/EmailService");

router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message, subject } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields (name, email, message)." });
    }

    // Send email using EmailService
    const result = await EmailService.sendContactMessage(name, email, phone, message, subject);
    
    if (result.success) {
      return res.json({ success: true, message: "Message sent successfully.", messageId: result.messageId });
    } else {
      return res.status(500).json({ success: false, message: "Failed to send message.", error: result.error });
    }
  } catch (err) {
    console.error("Error in contact route:", err);
    return res.status(500).json({ success: false, message: "Failed to send message." });
  }
});

module.exports = router;
