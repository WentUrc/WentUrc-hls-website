// Collect Next.js static export (out/) into repository root assets.
// This script copies:
// - frontend/out -> assets (merge contents)

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }

async function copyRecursive(src, dest) {
  const stat = await fsp.stat(src);
  if (stat.isDirectory()) {
    await ensureDir(dest);
    const entries = await fsp.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await ensureDir(path.dirname(dest));
    await fsp.copyFile(src, dest);
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const frontend = path.join(root, 'frontend');
  // Next 15 with output: 'export' writes exported files into distDir (here: frontend/assets)
  const outDir = path.join(frontend, 'assets');
  const destBase = path.join(root, 'assets');

  if (!(await exists(outDir))) {
    console.error(`[collect-export] not found: ${outDir}. Did you run "npm run build" in frontend?`);
    process.exit(1);
  }

  console.log(`[collect-export] ensuring destination: ${destBase}`);
  await ensureDir(destBase);

  console.log(`[collect-export] copying out -> ${destBase}`);
  await copyRecursive(outDir, destBase);

  console.log('[collect-export] done');
}

main().catch((err) => { console.error(err); process.exit(1); });
