import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');

// Standard icon SVG (with squircle rounded corners for standard icon and apple-touch-icon)
const standardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="capGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)" />
  <rect x="8" y="8" width="496" height="496" rx="92" fill="none" stroke="#60a5fa" stroke-width="3" stroke-opacity="0.3" />
  <g filter="url(#shadow)">
    <path d="M256 128 L432 208 L256 288 L80 208 Z" fill="#ffffff" />
    <path d="M156 244 L156 312 C156 348 200 376 256 376 C312 376 356 348 356 312 L356 244 L256 290 Z" fill="#e0e7ff" opacity="0.95" />
    <circle cx="256" cy="208" r="14" fill="url(#capGlow)" />
    <path d="M256 208 Q396 230 408 320" fill="none" stroke="url(#capGlow)" stroke-width="12" stroke-linecap="round" />
    <rect x="398" y="318" width="20" height="48" rx="6" fill="url(#capGlow)" />
    <path d="M388 120 Q388 148 416 148 Q388 148 388 176 Q388 148 360 148 Q388 148 388 120 Z" fill="#38bdf8" />
    <circle cx="388" cy="148" r="4" fill="#ffffff" />
    <path d="M128 352 Q128 370 146 370 Q128 370 128 388 Q128 370 110 370 Q128 370 128 352 Z" fill="#fbbf24" opacity="0.9" />
  </g>
</svg>`;

// Full bleed maskable SVG with 20% safe-zone margin (elements safely within central 80% circle)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <linearGradient id="capGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.35" />
    </filter>
  </defs>
  <!-- Full bleed background for Android adaptive masking -->
  <rect width="512" height="512" fill="url(#bg)" />
  <!-- Scaled elements centered within safe zone (80% scale around center 256, 256) -->
  <g transform="translate(256, 256) scale(0.78) translate(-256, -256)" filter="url(#shadow)">
    <path d="M256 128 L432 208 L256 288 L80 208 Z" fill="#ffffff" />
    <path d="M156 244 L156 312 C156 348 200 376 256 376 C312 376 356 348 356 312 L356 244 L256 290 Z" fill="#e0e7ff" opacity="0.95" />
    <circle cx="256" cy="208" r="14" fill="url(#capGlow)" />
    <path d="M256 208 Q396 230 408 320" fill="none" stroke="url(#capGlow)" stroke-width="12" stroke-linecap="round" />
    <rect x="398" y="318" width="20" height="48" rx="6" fill="url(#capGlow)" />
    <path d="M388 120 Q388 148 416 148 Q388 148 388 176 Q388 148 360 148 Q388 148 388 120 Z" fill="#38bdf8" />
    <circle cx="388" cy="148" r="4" fill="#ffffff" />
    <path d="M128 352 Q128 370 146 370 Q128 370 128 388 Q128 370 110 370 Q128 370 128 352 Z" fill="#fbbf24" opacity="0.9" />
  </g>
</svg>`;

async function generate() {
  const stdBuffer = Buffer.from(standardSvg);
  const maskableBuffer = Buffer.from(maskableSvg);

  // 1. 192x192
  await sharp(stdBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 2. 512x512
  await sharp(stdBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // 3. Maskable 512x512
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  // 4. Apple Touch Icon 180x180
  await sharp(stdBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 5. Favicon 32x32 PNG
  await sharp(stdBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png');

  // 6. Favicon 64x64 ico fallback
  await sharp(stdBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Created favicon.ico');
}

generate().catch(console.error);
