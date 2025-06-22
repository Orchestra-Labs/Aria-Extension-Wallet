import fs from 'fs';
import path from 'path';

const version = process.argv[2];
if (!version) {
  console.error('❌ No version specified.\nUsage: yarn set-version 1.3.3');
  process.exit(1);
}

const files = ['package.json', 'public/manifest.json'];

files.forEach(file => {
  const filePath = path.resolve(process.cwd(), file);
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);
  json.version = version;
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  console.log(`✅ Updated ${file} to version ${version}`);
});
