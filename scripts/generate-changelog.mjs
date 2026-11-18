import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetVersion = process.argv[2] || 'v1.0.1';
const formattedVersion = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
const customNotes = process.argv[3] || process.env.CUSTOM_RELEASE_NOTES || '';
const repo = process.env.GITHUB_REPOSITORY || 'rizkyaryendigumilang/life-planner-saas';

let prevTag = '';
try {
  prevTag = execSync('git describe --tags --abbrev=0 HEAD^', { cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  prevTag = '';
}

const gitRange = prevTag ? `${prevTag}..HEAD` : '-n 35';
const logCommand = `git log ${gitRange} --pretty=format:"%h|%s"`;

let logOutput = '';
try {
  logOutput = execSync(logCommand, { cwd: rootDir }).toString().trim();
} catch (err) {
  console.error('Failed to get git log:', err.message);
}

const lines = logOutput.split('\n').filter(Boolean);

const bugs = [];
const features = [];
const optimizations = [];
const maintenance = [];
const others = [];

for (const line of lines) {
  const [hash, ...rest] = line.split('|');
  const subject = rest.join('|').trim();
  const lower = subject.toLowerCase();

  const item = `- ${subject} (\`${hash}\`)`;

  if (/^(fix|bug|hotfix)(\([^)]+\))?:/i.test(subject) || lower.includes('fix ') || lower.includes('bug')) {
    bugs.push(item);
  } else if (/^feat(\([^)]+\))?:/i.test(subject) || lower.includes('feature')) {
    features.push(item);
  } else if (/^perf(\([^)]+\))?:/i.test(subject) || lower.includes('optimize') || lower.includes('speed')) {
    optimizations.push(item);
  } else if (/^(refactor|chore|test|clean|docs)(\([^)]+\))?:/i.test(subject)) {
    maintenance.push(item);
  } else {
    others.push(item);
  }
}

const now = new Date().toISOString().split('T')[0];

let markdown = `## 📱 Life Planner Mobile ${formattedVersion} (${now})\n\n`;
markdown += `Rilis otomatis aplikasi mobile Life Planner untuk Android (.apk) dan iOS (.ipa).\n\n`;

markdown += `### 📦 Unduhan File Aplikasi (Direct Download)\n`;
markdown += `| Platform | File Download | Status | Keterangan |\n`;
markdown += `| :--- | :--- | :--- | :--- |\n`;
markdown += `| 🤖 **Android** | [\`life-planner-${formattedVersion}-android.apk\`](https://github.com/${repo}/releases/download/${formattedVersion}/life-planner-${formattedVersion}-android.apk) | ✅ Siap Install | APK Standalone (Dukungan Android 8.0+ / HarmonyOS) |\n`;
markdown += `| 🍎 **iOS** | [\`life-planner-${formattedVersion}-ios.ipa\`](https://github.com/${repo}/releases/download/${formattedVersion}/life-planner-${formattedVersion}-ios.ipa) | 📦 Unsigned Package | IPA Sideload (Install via AltStore / Sideloadly / TrollStore) |\n\n`;

if (customNotes.trim()) {
  markdown += `### 📌 Catatan Rilis Khusus\n`;
  markdown += `${customNotes.trim()}\n\n`;
}

markdown += `### 📋 Ringkasan Pembaruan & Perbaikan Bug\n\n`;

if (bugs.length > 0) {
  markdown += `#### 🐛 Perbaikan Bug & Stabilitas\n`;
  markdown += bugs.join('\n') + '\n\n';
}

if (features.length > 0) {
  markdown += `#### 🚀 Fitur Baru & Peningkatan\n`;
  markdown += features.join('\n') + '\n\n';
}

if (optimizations.length > 0) {
  markdown += `#### ⚡ Optimasi & Performa\n`;
  markdown += optimizations.join('\n') + '\n\n';
}

if (maintenance.length > 0) {
  markdown += `#### 🔧 Pemeliharaan Kode & Refaktor\n`;
  markdown += maintenance.join('\n') + '\n\n';
}

if (others.length > 0 && (bugs.length + features.length + optimizations.length === 0)) {
  markdown += `#### 📝 Komit Terbaru\n`;
  markdown += others.join('\n') + '\n\n';
}

markdown += `\n### 📲 Petunjuk Instalasi:\n`;
markdown += `1. **Android:** Unduh file \`.apk\`, buka file di HP Anda, dan pilih **Install**. Jika muncul peringatan keamanan, izinkan *"Install from Unknown Sources"*.\n`;
markdown += `2. **iOS:** Unduh file \`.ipa\` ke komputer, gunakan **AltStore**, **Sideloadly**, atau **TrollStore** untuk memasang aplikasi ke iPhone/iPad Anda.\n\n`;
markdown += `---\n*Automated Mobile Release by GitHub Actions CI/CD.*\n`;

const outputPath = path.join(rootDir, 'RELEASE_NOTES.md');
fs.writeFileSync(outputPath, markdown, 'utf8');
console.log(`Generated changelog successfully at ${outputPath}`);
