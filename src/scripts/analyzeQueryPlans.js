import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../db/index.js';
import Gym from '../models/gym.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';

dotenv.config({ path: './.env' });

const REPORT_DIR = path.resolve('docs');
const JSON_REPORT_PATH = path.join(REPORT_DIR, 'query-plan-report.json');
const MARKDOWN_REPORT_PATH = path.join(REPORT_DIR, 'query-plan-report.md');

const collectIndexNames = (node, bucket = new Set()) => {
  if (!node || typeof node !== 'object') {
    return bucket;
  }

  if (node.indexName) {
    bucket.add(node.indexName);
  }

  Object.values(node).forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => collectIndexNames(entry, bucket));
      return;
    }

    collectIndexNames(value, bucket);
  });

  return bucket;
};

const summarizeExplain = (label, explain) => ({
  label,
  winningPlanStage: explain.queryPlanner?.winningPlan?.stage ?? null,
  indexesUsed: Array.from(collectIndexNames(explain.queryPlanner?.winningPlan)),
  totalDocsExamined: explain.executionStats?.totalDocsExamined ?? null,
  totalKeysExamined: explain.executionStats?.totalKeysExamined ?? null,
  nReturned: explain.executionStats?.nReturned ?? null,
});

const toMarkdown = (report) => {
  const lines = [
    '# Query Plan Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '| Query | Winning Stage | Indexes Used | Keys Examined | Docs Examined | Returned |',
    '| --- | --- | --- | ---: | ---: | ---: |',
  ];

  report.results.forEach((entry) => {
    lines.push(
      `| ${entry.label} | ${entry.winningPlanStage ?? 'n/a'} | ${entry.indexesUsed.join(', ') || 'n/a'} | ${entry.totalKeysExamined ?? 0} | ${entry.totalDocsExamined ?? 0} | ${entry.nReturned ?? 0} |`,
    );
  });

  lines.push('');
  lines.push('Representative queries:');
  lines.push('- Public gym catalogue search');
  lines.push('- Public marketplace catalogue search');
  lines.push('- Seller order lookup');

  return lines.join('\n');
};

const main = async () => {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await connectDB();

  await Promise.all([Gym.init(), Product.init(), Order.init()]);

  const [gymExplain, productExplain, sellerOrderExplain] = await Promise.all([
    Gym.collection
      .find({ status: 'active', isPublished: true, $text: { $search: 'fitness mumbai' } })
      .sort({ score: { $meta: 'textScore' }, 'analytics.impressions': -1, createdAt: -1 })
      .limit(12)
      .explain('executionStats'),
    Product.collection
      .find({ isPublished: true, category: 'supplements', $text: { $search: 'protein whey' } })
      .sort({ score: { $meta: 'textScore' }, updatedAt: -1 })
      .limit(12)
      .explain('executionStats'),
    Order.collection
      .find({ 'orderItems.seller': new mongoose.Types.ObjectId('000000000000000000000001') })
      .sort({ createdAt: -1 })
      .limit(20)
      .explain('executionStats'),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    results: [
      summarizeExplain('Gym catalogue text search', gymExplain),
      summarizeExplain('Marketplace catalogue text search', productExplain),
      summarizeExplain('Seller order lookup', sellerOrderExplain),
    ],
  };

  await fs.writeFile(JSON_REPORT_PATH, JSON.stringify(report, null, 2));
  await fs.writeFile(MARKDOWN_REPORT_PATH, toMarkdown(report));
  await mongoose.connection.close();

  console.log(`Query plan report written to ${JSON_REPORT_PATH}`);
};

main().catch(async (error) => {
  console.error('Query plan analysis failed', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
