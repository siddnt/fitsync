import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Contact from "../models/contact.model.js";

// Handle contact form submission
export const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, message } = req.body;
  
  // Validation
  if (!name || !email || !message) {
    throw new ApiError(400, "All fields are required");
  }
  
  // Create contact submission
  const contact = await Contact.create({
    name,
    email,
    message
  });
  
  // Check if request expects JSON (API) or HTML (form)
  if (req.headers['content-type'] === 'application/json') {
    return res.status(201).json(
      new ApiResponse(201, contact, "Message sent successfully")
    );
  }
  
  // For regular form submission, redirect with success message
  req.flash("success", "Thank you! Your message has been sent successfully.");
  return res.redirect("/contact");
});

// Get all contact messages (for admin)
export const getContactMessages = asyncHandler(async (req, res) => {
  // Find all messages, sorted by newest first
  const messages = await Contact.find().sort({ createdAt: -1 });
  
  // Check if request expects JSON (API) or HTML
  if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
    return res.status(200).json(
      new ApiResponse(200, messages, "Contact messages retrieved successfully")
    );
  }
  
  // For HTML view, render admin messages page
  return res.render("pages/adminMessages", {
    title: "Contact Messages - FitSync Admin",
    messages,
    isLoggedIn: true,
    userRole: req.session.userRole,
    userId: req.session.userId
  });
});

// Mark message as read
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find and update message
  const message = await Contact.findByIdAndUpdate(
    id,
    { status: "read" },
    { new: true }
  );
  
  if (!message) {
    throw new ApiError(404, "Message not found");
  }
  
  // Check if request expects JSON (API) or HTML
  if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
    return res.status(200).json(
      new ApiResponse(200, message, "Message marked as read")
    );
  }
  
  // For HTML response, redirect back to messages page with success message
  req.flash("success", "Message marked as read");
  return res.redirect("/admin/messages");
});

// Mark message as responded
export const markAsResponded = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find and update message
  const message = await Contact.findByIdAndUpdate(
    id,
    { status: "responded" },
    { new: true }
  );
  
  if (!message) {
    throw new ApiError(404, "Message not found");
  }
  
  // Check if request expects JSON (API) or HTML
  if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
    return res.status(200).json(
      new ApiResponse(200, message, "Message marked as responded")
    );
  }
  
  // For HTML response, redirect back to messages page with success message
  req.flash("success", "Message marked as responded");
  return res.redirect("/admin/messages");
}); 