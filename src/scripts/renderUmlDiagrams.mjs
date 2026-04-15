import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';

const repoRoot = process.cwd();
const umlDir = path.join(repoRoot, 'docs', 'uml');
const jarPath = path.join(repoRoot, 'tools', 'plantuml.jar');
const plantUmlUrl = 'https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar';

const downloadFile = (url, destination) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          downloadFile(response.headers.location, destination).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', async () => {
          try {
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await fs.writeFile(destination, Buffer.concat(chunks));
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
    child.on('error', reject);
  });

const main = async () => {
  await fs.mkdir(path.dirname(jarPath), { recursive: true });

  try {
    await fs.access(jarPath);
  } catch {
    console.log('Downloading PlantUML...');
    await downloadFile(plantUmlUrl, jarPath);
  }

  console.log('Rendering UML diagrams to SVG...');
  const umlFiles = (await fs.readdir(umlDir))
    .filter((file) => file.endsWith('.puml'))
    .map((file) => path.join(umlDir, file));

  await run('java', ['-Djava.awt.headless=true', '-jar', jarPath, '-tsvg', ...umlFiles]);
};

main().catch((error) => {
  console.error('UML render failed', error);
  process.exit(1);
});
