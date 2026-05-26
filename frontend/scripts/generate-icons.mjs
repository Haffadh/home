// Rasterizes public/icon.svg into PNG app-icon sizes.
// Run with: node scripts/generate-icons.mjs

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 }, // iOS home screen
  { name: "apple-touch-icon-152.png", size: 152 }, // iPad
  { name: "apple-touch-icon-167.png", size: 167 }, // iPad Pro
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

const svg = await readFile(join(publicDir, "icon.svg"));

for (const { name, size } of sizes) {
  const out = join(publicDir, name);
  await sharp(svg)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${name} (${size}x${size})`);
}

// Generate favicon.ico (32x32)
const ico32 = await sharp(svg).resize(32, 32).png().toBuffer();
await writeFile(join(publicDir, "favicon-32.png"), ico32);
console.log("✓ favicon-32.png");
