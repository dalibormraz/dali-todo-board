// Vygeneruje PNG ikony pro PWA / iOS — žlutý post-it s nápisem "DALI TODO".
//   node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const VIOLET = "#6b4eff";
const PAPER = "#fcef9c";
const PAPER_D = "#f4e375";
const INK = "#1f2430";
const GREEN = "#7bbf3a";

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

// motiv: post-it lísteček s textem DALI / TODO. scale = velikost lístečku vůči plátnu.
function art(scale = 1) {
  const cx = 512;
  const cy = 512;
  const w = 770 * scale;
  const h = 770 * scale;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = 64 * scale;
  const fs = 232 * scale;
  return `
    <g transform="rotate(-5 ${cx} ${cy})">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${PAPER}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${48 * scale}" rx="${r}" fill="${PAPER_D}"/>
      <rect x="${x}" y="${y + 30 * scale}" width="${w}" height="${20 * scale}" fill="${PAPER_D}"/>
      <text x="${cx}" y="${cy - 24 * scale}" text-anchor="middle"
            font-family="${FONT}" font-weight="800" font-size="${fs}"
            letter-spacing="${6 * scale}" fill="${INK}">DALI</text>
      <text x="${cx}" y="${cy + 196 * scale}" text-anchor="middle"
            font-family="${FONT}" font-weight="800" font-size="${fs}"
            letter-spacing="${6 * scale}" fill="${INK}">TODO</text>
      <rect x="${cx - 168 * scale}" y="${cy + 236 * scale}" width="${336 * scale}" height="${20 * scale}" rx="${10 * scale}" fill="${GREEN}"/>
    </g>`;
}

function svg(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="${VIOLET}"/>
    ${art(scale)}
  </svg>`;
}

async function render(svgStr, size, out) {
  await sharp(Buffer.from(svgStr))
    .resize(size, size)
    .flatten({ background: VIOLET }) // bez průhlednosti (iOS to vyžaduje)
    .png()
    .toFile(out);
  console.log("✓", out, `${size}×${size}`);
}

await mkdir("public", { recursive: true });
const full = svg(1); // full-bleed pro iOS
const padded = svg(0.7); // maskable se safe-zónou pro Android

await render(full, 180, "public/apple-touch-icon.png");
await render(full, 192, "public/icon-192.png");
await render(full, 512, "public/icon-512.png");
await render(padded, 512, "public/icon-512-maskable.png");
console.log("Hotovo.");
