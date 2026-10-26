/**
 * ابزار توسعه: پلیگون‌های Plan.html را استخراج و در drizzle/seed/units.json می‌نویسد.
 * اجرای دستی: node scripts/extract-plan-polygons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const planPath = path.join(root, 'Plan.html');
const outPath = path.join(root, 'drizzle', 'seed', 'units.json');

const html = readFileSync(planPath, 'utf8');

const viewBox = /<svg[^>]*viewBox="([^"]+)"/i.exec(html)?.[1] ?? '';
const polygons = [...html.matchAll(/<polygon\s+points="([^"]+)"[^>]*data-name="([^"]+)"/gi)].map(
  (m) => ({ name: m[2], points: m[1] }),
);

if (!polygons.length) {
  console.error('هیچ پلیگونی در Plan.html پیدا نشد.');
  process.exit(1);
}

polygons.sort((a, b) => Number(a.name) - Number(b.name));

const data = {
  source: 'Plan.html',
  viewBox,
  units: polygons.map((p) => ({ code: p.name, points: p.points })),
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`${data.units.length} polygon -> ${path.relative(root, outPath)} (viewBox: ${viewBox})`);
