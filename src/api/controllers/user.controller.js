import User from '../../models/user.model.js';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import Order from '../../models/order.model.js';
import Product from '../../models/product.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { listNotificationsForUser, markNotificationsRead } from '../../services/notification.service.js';
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

export const getMyNotifications = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const unreadOnly = String(req.query.unreadOnly ?? '').toLowerCase() === 'true';
  const { notifications, unreadCount } = await listNotificationsForUser(req.user, { limit, unreadOnly });

  return res.status(200).json(new ApiResponse(200, {
    notifications: notifications.map(notification => ({ ...notification, id: notification._id })),
    unreadCount,
  }, 'Notifications fetched successfully'));
});

export const markMyNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((value) => String(value)).filter(Boolean)
    : [];

  const result = await markNotificationsRead({ userId, ids });
  return res.status(200).json(new ApiResponse(200, {
    marked: result.modifiedCount ?? 0,
  }, 'Notifications marked as read'));
});

export const getMyRecommendations = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id).select('role fitnessGoals address profile.location traineeMetrics').lean();
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const [membership, recentOrders] = await Promise.all([
    GymMembership.findOne({ trainee: user._id, status: { $in: ['active', 'paused'] } })
      .sort({ createdAt: -1 })
      .select('gym')
      .lean(),
    Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({ path: 'orderItems.product', select: 'category' })
      .lean(),
  ]);

  const primaryCity = [user.profile?.location, user.address]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);
  const boughtCategories = recentOrders.flatMap((order) =>
    (order.orderItems || []).map((item) => item.product?.category).filter(Boolean));
  const preferredCategory = boughtCategories[0] ?? 'supplements';

  const gymFilter = {
    status: 'active',
    isPublished: true,
    ...(membership?.gym ? { _id: { $ne: membership.gym } } : {}),
  };
  if (primaryCity) {
    gymFilter['location.city'] = { $regex: primaryCity, $options: 'i' };
  }

  const gyms = await Gym.find(gymFilter)
    .sort({ 'analytics.rating': -1, 'analytics.memberships': -1, createdAt: -1 })
    .limit(5)
    .select('name location pricing analytics')
    .lean();

  const products = await Product.find({
    isPublished: true,
    status: 'available',
    ...(preferredCategory ? { category: preferredCategory } : {}),
  })
    .sort({ 'metrics.reviews.averageRating': -1, 'metrics.sales.totalSold': -1, updatedAt: -1 })
    .limit(5)
    .select('name category price image metrics')
    .lean();

  return res.status(200).json(new ApiResponse(200, {
    gyms: gyms.map((gym) => ({
      id: gym._id,
      name: gym.name,
      city: gym.location?.city,
      monthlyPrice: gym.pricing?.monthlyPrice ?? gym.pricing?.monthlyMrp,
      rating: gym.analytics?.rating ?? 0,
      membershipCount: gym.analytics?.memberships ?? 0,
    })),
    products: products.map((product) => ({
      id: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      image: product.image,
      averageRating: product.metrics?.reviews?.averageRating ?? 0,
      totalSold: product.metrics?.sales?.totalSold ?? 0,
    })),
  }, 'Recommendations fetched successfully'));
});
