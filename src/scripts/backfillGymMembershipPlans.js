import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../db/index.js';
import Gym from '../models/gym.model.js';
import {
  buildGymPricingSnapshot,
  normalizeMembershipPlanCode,
} from '../utils/membershipPlans.js';

dotenv.config();

const isMonthlyOnlyPricing = (pricing = {}) => {
  const storedPlans = Array.isArray(pricing?.membershipPlans) ? pricing.membershipPlans : [];

  if (!storedPlans.length) {
    return true;
  }

  const normalizedCodes = storedPlans
    .map((plan) => normalizeMembershipPlanCode(plan?.code || plan?.planCode))
    .filter(Boolean);

  return normalizedCodes.length === 1 && normalizedCodes[0] === 'monthly';
};

const backfillGymMembershipPlans = async () => {
  let inspected = 0;
  let modified = 0;
  const touchedGyms = [];

  try {
    await connectDB();

    const gyms = await Gym.find({})
      .select('_id name pricing')
      .lean();

    for (const gym of gyms) {
      inspected += 1;

      if (!isMonthlyOnlyPricing(gym?.pricing)) {
        continue;
      }

      const snapshot = buildGymPricingSnapshot(gym?.pricing || {});
      const derivedPlans = Array.isArray(snapshot?.membershipPlans) ? snapshot.membershipPlans : [];

      if (derivedPlans.length <= 1) {
        continue;
      }

      const result = await Gym.updateOne(
        { _id: gym._id },
        {
          $set: {
            'pricing.monthlyMrp': snapshot.monthlyMrp,
            'pricing.monthlyPrice': snapshot.monthlyPrice,
            'pricing.currency': snapshot.currency,
            'pricing.membershipPlans': derivedPlans,
          },
        },
      );

      if (result.modifiedCount > 0) {
        modified += 1;
        touchedGyms.push(`${gym.name} (${gym._id})`);
      }
    }

    console.log(`Inspected ${inspected} gym document(s).`);
    console.log(`Backfilled explicit membership plans for ${modified} gym document(s).`);

    if (touchedGyms.length) {
      console.log('Updated gyms:');
      touchedGyms.forEach((entry) => console.log(`- ${entry}`));
    }
  } catch (error) {
    console.error('Failed to backfill gym membership plans:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode ?? 0);
  }
};

backfillGymMembershipPlans();
