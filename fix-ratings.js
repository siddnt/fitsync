import mongoose from 'mongoose';
import Gym from './src/models/gym.model.js';
import Review from './src/models/review.model.js';
import dotenv from 'dotenv';
import path from 'path';
import { DB_NAME } from './src/constants.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME });
  const gyms = await Gym.find({}, 'analytics name');
  for (const gym of gyms) {
    const [stats] = await Review.aggregate([
      { $match: { gym: gym._id } },
      {
        $group: {
          _id: '$gym',
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);
    const avgRating = stats ? Number(stats.avgRating.toFixed(1)) : 0;
    const totalReviews = stats?.totalReviews ?? 0;
    
    // Ensure analytics object exists
    const analytics = gym.analytics || {};
    analytics.rating = avgRating;
    analytics.ratingCount = totalReviews;

    await Gym.findByIdAndUpdate(gym._id, {
      $set: {
        analytics: analytics
      },
    });
    console.log(`Updated gym ${gym.name} - ${totalReviews} ratings`);
  }
  process.exit(0);
}
run();
