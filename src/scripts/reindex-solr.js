import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import Gym from '../models/gym.model.js';
import Product from '../models/product.model.js';
import {
  indexGymDocument,
  indexProductDocument,
  initSolr,
  isSolrReady,
} from '../services/solr.service.js';

dotenv.config({ path: './.env' });

const indexInBatches = async (items, indexFn, batchSize = 50) => {
  let successCount = 0;

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.all(batch.map((item) => indexFn(item)));
    successCount += results.filter(Boolean).length;
  }

  return successCount;
};

const run = async () => {
  await connectDB();
  await initSolr();

  if (!isSolrReady()) {
    throw new Error('Solr is not ready. Set SOLR_URL and ensure the core is reachable.');
  }

  const [gyms, products] = await Promise.all([
    Gym.find().lean(),
    Product.find().lean(),
  ]);

  console.log(`Reindexing ${gyms.length} gyms and ${products.length} products...`);

  const [indexedGyms, indexedProducts] = await Promise.all([
    indexInBatches(gyms, indexGymDocument),
    indexInBatches(products, indexProductDocument),
  ]);

  console.log(`Gym documents indexed: ${indexedGyms}/${gyms.length}`);
  console.log(`Product documents indexed: ${indexedProducts}/${products.length}`);
};

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Solr reindex failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
