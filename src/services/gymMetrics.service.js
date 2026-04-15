import mongoose from 'mongoose';
import Gym from '../models/gym.model.js';
import Review from '../models/review.model.js';
import GymMembership from '../models/gymMembership.model.js';
import TrainerAssignment from '../models/trainerAssignment.model.js';

const toGymObjectId = (gymId) => new mongoose.Types.ObjectId(gymId);

export const calculateGymAnalyticsSnapshot = async (gymId, { session } = {}) => {
  const gymObjectId = toGymObjectId(gymId);

  const [reviewStats, membershipStats, trainerStats] = await Promise.all([
    Review.aggregate([
      { $match: { gym: gymObjectId } },
      {
        $group: {
          _id: '$gym',
          averageRating: { $avg: '$rating' },
          ratingCount: { $sum: 1 },
          lastReviewAt: { $max: '$updatedAt' },
        },
      },
    ]).session(session ?? null),
    GymMembership.aggregate([
      {
        $match: {
          gym: gymObjectId,
          plan: { $ne: 'trainer-access' },
          status: { $in: ['active', 'paused'] },
        },
      },
      {
        $group: {
          _id: '$gym',
          memberships: { $sum: 1 },
        },
      },
    ]).session(session ?? null),
    TrainerAssignment.aggregate([
      {
        $match: {
          gym: gymObjectId,
          status: 'active',
        },
      },
      {
        $group: {
          _id: '$gym',
          activeTrainers: { $sum: 1 },
        },
      },
    ]).session(session ?? null),
  ]);

  return {
    rating: reviewStats[0]?.averageRating
      ? Math.round(Number(reviewStats[0].averageRating) * 10) / 10
      : 0,
    ratingCount: Number(reviewStats[0]?.ratingCount ?? 0),
    memberships: Number(membershipStats[0]?.memberships ?? 0),
    trainers: Number(trainerStats[0]?.activeTrainers ?? 0),
    lastReviewAt: reviewStats[0]?.lastReviewAt ?? null,
  };
};

export const syncGymAnalyticsSnapshot = async (gymId, { session } = {}) => {
  const snapshot = await calculateGymAnalyticsSnapshot(gymId, { session });

  await Gym.updateOne(
    { _id: gymId },
    {
      $set: {
        'analytics.rating': snapshot.rating,
        'analytics.ratingCount': snapshot.ratingCount,
        'analytics.memberships': snapshot.memberships,
        'analytics.trainers': snapshot.trainers,
        'analytics.lastReviewAt': snapshot.lastReviewAt,
      },
    },
    { session },
  );

  return snapshot;
};
