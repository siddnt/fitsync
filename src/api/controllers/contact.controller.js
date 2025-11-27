import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import Contact from '../../models/contact.model.js';

export const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    throw new ApiError(400, 'All fields are required');
  }

  const contact = await Contact.create({
    name,
    email,
    message,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, contact, 'Message sent successfully'));
});

export const getContactMessages = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};

  const messages = await Contact.find(filter).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, messages, 'Messages fetched successfully'));
});

export const updateMessageStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['new', 'read', 'responded'].includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const message = await Contact.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  );

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, message, 'Message status updated successfully'));
});
