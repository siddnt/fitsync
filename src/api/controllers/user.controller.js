import User from '../../models/user.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { uploadOnCloudinary } from '../../utils/fileUpload.js';

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const {
    firstName,
    lastName,
    age,
    gender,
    height,
    weight,
    contactNumber,
    address,
    bio,
    profile,
  } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Update basic fields
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (age !== undefined) user.age = age;
  if (gender !== undefined) user.gender = gender;
  if (height !== undefined) user.height = height;
  if (weight !== undefined) user.weight = weight;
  if (contactNumber !== undefined) user.contactNumber = contactNumber;
  if (address !== undefined) user.address = address;
  if (bio !== undefined) user.bio = bio;

  // Update nested profile fields
  if (profile) {
    if (profile.headline !== undefined) user.profile.headline = profile.headline;
    if (profile.about !== undefined) user.profile.about = profile.about;
    if (profile.location !== undefined) user.profile.location = profile.location;
    if (profile.company !== undefined) user.profile.company = profile.company;
    if (profile.socialLinks) {
      if (profile.socialLinks.website !== undefined) {
        user.profile.socialLinks.website = profile.socialLinks.website;
      }
      if (profile.socialLinks.instagram !== undefined) {
        user.profile.socialLinks.instagram = profile.socialLinks.instagram;
      }
      if (profile.socialLinks.facebook !== undefined) {
        user.profile.socialLinks.facebook = profile.socialLinks.facebook;
      }
    }
  }

  // Handle profile picture upload
  if (req.file) {
    const result = await uploadOnCloudinary(req.file.path);
    if (result?.url) {
      user.profilePicture = result.url;
    }
  }

  await user.save({ validateBeforeSave: true });

  const updatedUser = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    profilePicture: user.profilePicture,
    profile: user.profile,
    age: user.age,
    gender: user.gender,
    height: user.height,
    weight: user.weight,
    contactNumber: user.contactNumber,
    address: user.address,
    bio: user.bio,
  };

  return res.status(200).json(new ApiResponse(200, updatedUser, 'Profile updated successfully'));
});

export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const user = await User.findById(userId).select('-password -refreshToken');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const profileData = {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    profilePicture: user.profilePicture,
    profile: user.profile,
    age: user.age,
    gender: user.gender,
    height: user.height,
    weight: user.weight,
    contactNumber: user.contactNumber,
    address: user.address,
    bio: user.bio,
  };

  return res.status(200).json(new ApiResponse(200, profileData, 'Profile fetched successfully'));
});
