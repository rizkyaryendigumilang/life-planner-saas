import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rawVersion = process.argv[2];
if (!rawVersion) {
  console.error('Usage: node scripts/bump-version.mjs <version> (e.g. 1.1.0 or v1.1.0)');
  process.exit(1);
}

const version = rawVersion.replace(/^v/, '').trim();
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
  console.error(`Invalid semver version: ${rawVersion}`);
  process.exit(1);
}

// 1. Update package.json
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`[package.json] Updated version from ${oldVersion} -> ${version}`);

// Calculate numeric build code: major * 10000 + minor * 100 + patch
const [major, minor, patch] = version.split('-')[0].split('.').map(Number);
const calculatedBuildCode = major * 10000 + minor * 100 + patch;

// 2. Update android/app/build.gradle
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${calculatedBuildCode}`);
  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log(`[android] Updated versionName to ${version}, versionCode to ${calculatedBuildCode}`);
}

// 3. Update ios/App/App.xcodeproj/project.pbxproj
const pbxPath = path.join(rootDir, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbxPath)) {
  let pbx = fs.readFileSync(pbxPath, 'utf8');
  pbx = pbx.replace(/MARKETING_VERSION\s*=\s*[^;]+;/g, `MARKETING_VERSION = ${version};`);
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g, `CURRENT_PROJECT_VERSION = ${calculatedBuildCode};`);
  fs.writeFileSync(pbxPath, pbx, 'utf8');
  console.log(`[ios] Updated MARKETING_VERSION to ${version}, CURRENT_PROJECT_VERSION to ${calculatedBuildCode}`);
}

console.log(`\nSuccessfully synchronized version ${version} across Web, Android, and iOS!`);
