// routes/contactRoutes.js
const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message, subject } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields (name, email, message)." });
    }

    // Lazy load EmailService only when needed
    const EmailService = require("../services/EmailService");

    // Send email using EmailService (non-blocking after response)
    let result = { success: false, error: "Not sent yet" };
    
    try {
      result = await EmailService().sendContactMessage(name, email, phone, message, subject);
    } catch (emailErr) {
      console.warn('⚠️ Email service error:', emailErr.message);
      // Don't fail - contact was received even if email failed
      result = { success: false, error: emailErr.message };
    }
    
    if (result.success) {
      return res.json({ success: true, message: "Message sent successfully.", messageId: result.messageId });
    } else {
      // Still return 200 - message was received by our system
      return res.status(200).json({ 
        success: true, 
        message: "Message received. We'll get back to you soon.",
        emailStatus: "pending",
        error: result.error 
      });
    }
  } catch (err) {
    console.error("Error in contact route:", err);
    return res.status(500).json({ success: false, message: "Failed to process message." });
  }
});

module.exports = router;
