import fs from 'fs';
import path from 'path';

const versionArg = process.argv[2];
if (!versionArg) {
  console.error('❌ No version specified.\nUsage: yarn set-version 1.3.3 | major | minor | fix');
  process.exit(1);
}

const files = ['package.json', 'public/manifest.json'];

// Function to parse and bump version
function getTargetVersion(currentVersion: string, versionArg: string) {
  // If it's already a full version number, return it
  if (/^\d+\.\d+\.\d+$/.test(versionArg)) {
    return versionArg;
  }

  // Parse current version
  const [major, minor, fix] = currentVersion.split('.').map(Number);

  // Bump based on the type
  switch (versionArg.toLowerCase()) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'fix':
      return `${major}.${minor}.${fix + 1}`;
    default:
      throw new Error(
        `Invalid version argument: ${versionArg}. Use 'major', 'minor', 'fix', or a full version like '1.2.3'`,
      );
  }
}

// Function to check current version in a file
function checkCurrentVersion(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    return json.version || null;
  } catch (error: any) {
    console.error(`Error reading ${filePath}: ${error.message}`);
    return null;
  }
}

// Get current version from the first available file
function getCurrentVersion() {
  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const version = checkCurrentVersion(filePath);
      if (version && /^\d+\.\d+\.\d+$/.test(version)) {
        return version;
      }
    }
  }
  throw new Error('Could not find a valid version in any of the target files');
}

try {
  // Get current version to determine target version if bump type is used
  const currentVersion = getCurrentVersion();
  const targetVersion = getTargetVersion(currentVersion, versionArg);

  console.log('📋 Current versions:');
  files.forEach(file => {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const fileVersion = checkCurrentVersion(filePath);
      console.log(`   ${file}: ${fileVersion || 'No version found'}`);
    } else {
      console.log(`   ${file}: File not found`);
    }
  });

  console.log(`\n🔄 Setting version to: ${targetVersion} (from ${versionArg})\n`);

  let updatedCount = 0;
  files.forEach(file => {
    const filePath = path.resolve(process.cwd(), file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${file} - file not found`);
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content);
      const oldVersion = json.version;

      if (json.version === targetVersion) {
        console.log(`ℹ️  ${file} already has version ${targetVersion} - no change needed`);
        return;
      }

      json.version = targetVersion;
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
      console.log(`✅ Updated ${file} from ${oldVersion} to ${targetVersion}`);
      updatedCount++;
    } catch (error: any) {
      console.error(`❌ Failed to update ${file}: ${error.message}`);
    }
  });

  if (updatedCount > 0) {
    console.log(`\n🎉 Version update completed! Updated ${updatedCount} file(s)`);
  } else {
    console.log('\nℹ️  No files needed updating');
  }
} catch (error: any) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
