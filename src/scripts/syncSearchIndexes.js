import '../config/bootstrapEnv.js';
import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import { syncSearchIndexes } from '../services/search.service.js';

const main = async () => {
  await connectDB();
  const status = await syncSearchIndexes();
  console.log('Search sync completed', status);
  await mongoose.connection.close();
};

main().catch(async (error) => {
  console.error('Search sync failed', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
