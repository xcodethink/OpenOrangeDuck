import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 48, 128];
const svgPath = join(__dirname, '../public/icons/icon.svg');
const outputDir = join(__dirname, '../public/icons');

// Read SVG and convert emoji to actual rendering
const svgContent = readFileSync(svgPath, 'utf8');

// Create a simpler SVG without emoji (emoji doesn't render well)
const simpleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#D946EF;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#grad)"/>
  <path d="M40 30h48c4 0 8 4 8 8v52c0 4-4 8-8 8H40c-4 0-8-4-8-8V38c0-4 4-8 8-8z" fill="white" fill-opacity="0.9"/>
  <path d="M44 42h40v4H44zm0 12h40v4H44zm0 12h28v4H44z" fill="#8B5CF6"/>
  <circle cx="88" cy="84" r="16" fill="#10B981"/>
  <path d="M82 84l4 4 8-8" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function generateIcons() {
  for (const size of sizes) {
    const outputPath = join(outputDir, `icon${size}.png`);

    await sharp(Buffer.from(simpleSvg))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon${size}.png`);
  }
  console.log('Done!');
}

generateIcons().catch(console.error);
