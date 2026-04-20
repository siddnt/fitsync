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
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 10;
  const skip = (page - 1) * limit;

  const [total, messages] = await Promise.all([
    Contact.countDocuments(filter),
    Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return res
    .status(200)
    .json(new ApiResponse(200, {
      messages,
      pagination: { page, limit, total, totalPages },
    }, 'Messages fetched successfully'));
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
