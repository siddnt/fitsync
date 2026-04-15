import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const outputFileIndex = args.findIndex((arg) => arg === '--outputFile');

if (outputFileIndex !== -1 && args[outputFileIndex + 1]) {
  const outputPath = path.resolve(args[outputFileIndex + 1]);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
}

process.env.NODE_ENV = 'test';

const child = spawn(
  process.execPath,
  ['--experimental-vm-modules', './node_modules/jest/bin/jest.js', ...args],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
