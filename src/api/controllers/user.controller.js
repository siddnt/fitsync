import User from '../../models/user.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { uploadOnCloudinary } from '../../utils/fileUpload.js';

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
};

const parseNumber = (value, { min, max } = {}) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  if (min !== undefined && numeric < min) {
    return min;
  }

  if (max !== undefined && numeric > max) {
    return max;
  }

  return numeric;
};

const parseStringArray = (value) => {
  if (!value && value !== '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    if (!value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (_error) {
      /* swallow */
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

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
    experienceYears,
    specializations,
    certifications,
    mentoredCount,
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

  const parsedExperience = parseNumber(experienceYears, { min: 0, max: 60 });
  if (parsedExperience !== undefined) {
    user.experienceYears = parsedExperience;
  }

  const parsedMentored = parseNumber(mentoredCount, { min: 0 });
  if (parsedMentored !== undefined) {
    user.mentoredCount = parsedMentored;
  }

  const parsedSpecialisations = parseStringArray(specializations);
  if (parsedSpecialisations !== undefined) {
    user.specializations = parsedSpecialisations;
  }

  const parsedCertifications = parseStringArray(certifications);
  if (parsedCertifications !== undefined) {
    user.certifications = parsedCertifications;
  }

  // Update nested profile fields
  const profileData = parseMaybeJson(profile);
  if (profileData) {
    if (profileData.headline !== undefined) user.profile.headline = profileData.headline;
    if (profileData.about !== undefined) user.profile.about = profileData.about;
    if (profileData.location !== undefined) user.profile.location = profileData.location;
    if (profileData.company !== undefined) user.profile.company = profileData.company;
    if (profileData.socialLinks) {
      if (profileData.socialLinks.website !== undefined) {
        user.profile.socialLinks.website = profileData.socialLinks.website;
      }
      if (profileData.socialLinks.instagram !== undefined) {
        user.profile.socialLinks.instagram = profileData.socialLinks.instagram;
      }
      if (profileData.socialLinks.facebook !== undefined) {
        user.profile.socialLinks.facebook = profileData.socialLinks.facebook;
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
    experienceYears: user.experienceYears,
    mentoredCount: user.mentoredCount,
    specializations: user.specializations,
    certifications: user.certifications,
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
    experienceYears: user.experienceYears,
    mentoredCount: user.mentoredCount,
    specializations: user.specializations,
    certifications: user.certifications,
  };

  return res.status(200).json(new ApiResponse(200, profileData, 'Profile fetched successfully'));
});
