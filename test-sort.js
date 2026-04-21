import mongoose from 'mongoose';
import Gym from './src/models/gym.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const gyms = await Gym.find({}, 'name sponsorship.status analytics.impressions').sort({ 'sponsorship.status': 1, 'analytics.impressions': -1 });
  console.log(gyms.map(g => `${g.name} - ${g.sponsorship?.status}`));
  process.exit(0);
}
run();
