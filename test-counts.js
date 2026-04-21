import mongoose from 'mongoose';
import Gym from './src/models/gym.model.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const gym = await Gym.findOne({ name: 'Pulse Forge Fitness' }, 'analytics');
  console.log('Pulse Forge Fitness analytics:', gym?.analytics);
  process.exit(0);
}
run();
