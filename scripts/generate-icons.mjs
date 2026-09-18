import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

const bg = "#0a0d12";
const amber = "#ffb020";
const cyan = "#2dd4c4";

function markSvg(size, padding = 0) {
  const s = size;
  const p = padding;
  const inner = s - p * 2;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${s}" height="${s}" fill="${bg}"/>
  <g transform="translate(${p},${p})">
    <rect x="0" y="0" width="${inner}" height="${inner}" rx="${inner * 0.22}" fill="${bg}"/>
    <path d="M ${inner * 0.42} ${inner * 0.16}
             L ${inner * 0.66} ${inner * 0.16}
             L ${inner * 0.5} ${inner * 0.46}
             L ${inner * 0.64} ${inner * 0.46}
             L ${inner * 0.36} ${inner * 0.86}
             L ${inner * 0.44} ${inner * 0.52}
             L ${inner * 0.3} ${inner * 0.52}
             Z" fill="${amber}"/>
    <circle cx="${inner * 0.5}" cy="${inner * 0.5}" r="${inner * 0.46}" fill="none" stroke="${cyan}" stroke-width="${Math.max(2, inner * 0.02)}" opacity="0.5"/>
  </g>
</svg>`;
}

const jobs = [
  { name: "icon-192.png", size: 192, pad: 0 },
  { name: "icon-512.png", size: 512, pad: 0 },
  { name: "maskable-192.png", size: 192, pad: 24 },
  { name: "maskable-512.png", size: 512, pad: 64 },
  { name: "apple-touch-icon.png", size: 180, pad: 12 },
];

for (const job of jobs) {
  await sharp(Buffer.from(markSvg(job.size, job.pad)))
    .png()
    .toFile(`public/icons/${job.name}`);
  console.log("wrote", job.name);
}

await sharp(Buffer.from(markSvg(32, 2))).png().toFile("public/favicon-32.png");
console.log("done");
