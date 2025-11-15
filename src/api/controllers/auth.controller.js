import User from '../../models/user.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
};

const serializeUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  profilePicture: user.profilePicture,
  profile: user.profile,
  ownerMetrics: user.ownerMetrics,
  traineeMetrics: user.traineeMetrics,
  trainerMetrics: user.trainerMetrics,
});

export const register = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    role = 'trainee',
    profile = {},
    contactNumber,
    address,
    age,
    gender,
  } = req.body;

  if (!firstName && !req.body.name) {
    throw new ApiError(400, 'First name is required');
  }

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }

  const pendingRoles = new Set(['trainer', 'seller']);
  const defaultStatus = pendingRoles.has(role) ? 'pending' : 'active';

  const user = await User.create({
    firstName,
    lastName,
    email: normalizedEmail,
    password,
    role,
    profile,
    contactNumber,
    address,
    age,
    gender,
    status: defaultStatus,
  });

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const payload = {
    user: serializeUser(user),
    accessToken,
  };

  return res.status(201).json(new ApiResponse(201, payload, 'Registration successful'));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new ApiError(404, 'User does not exist');
  }

  if (user.status === 'inactive' && user.role !== 'admin') {
    throw new ApiError(403, 'Account is inactive. Please contact support.');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const payload = {
    user: serializeUser(user),
    accessToken,
  };

  return res.status(200).json(new ApiResponse(200, payload, 'Login successful'));
});

export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    throw new ApiError(401, 'Refresh token missing');
  }

  const user = await User.findOne({ refreshToken: token });

  if (!user) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const accessToken = user.generateAccessToken();
  return res
    .status(200)
    .json(new ApiResponse(200, { accessToken }, 'Access token refreshed successfully'));
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const user = await User.findOne({ refreshToken: token });
    if (user) {
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
    }
  }

  res.clearCookie('refreshToken', cookieOptions);
  return res.status(204).send();
});

export const me = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const user = await User.findById(userId).select('-password -refreshToken');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return res.status(200).json(new ApiResponse(200, serializeUser(user), 'Fetched profile'));
});
