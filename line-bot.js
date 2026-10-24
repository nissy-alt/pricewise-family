import {compare, formatMoney, unitLabel} from './pricing.js';

export const HELP = `ส่งสินค้า 2–5 รายการ บรรทัดละ 1 ชิ้น เช่น\n400 ml ฿159\n500 ml ฿184\n\nใส่ชื่อสินค้าและส่วนลดได้ เช่น\nนม A 159 400ml ลด 10%\nนม B 184 500ml\n\nรองรับ ml, ลิตร, g, kg และชิ้น หรือพิมพ์ “เว็บ” เพื่อเปิด PriceWise`;
const URL = 'https://pricewise-family.pages.dev/';
const unitRe = '(ml|มล\\.?|ลิตร|l|g|กรัม|kg|กก\\.?|ชิ้น)';
const numberRe = '([0-9][0-9,]*(?:\\.[0-9]+)?)';
const quantityFirst = new RegExp(`${numberRe}\\s*${unitRe}\\s*(?:ราคา\\s*)?฿?\\s*${numberRe}\\s*(?:บาท)?`, 'i');
const priceFirst = new RegExp(`฿?\\s*${numberRe}\\s*(?:บาท)?\\s+${numberRe}\\s*${unitRe}`, 'i');
const numeric = value => Number(value.replaceAll(',', ''));

function normalizeUnit(value) {
  const unit = value.toLowerCase().replaceAll('.', '');
  if (unit === 'มล') return 'ml';
  if (unit === 'ลิตร') return 'l';
  if (unit === 'กรัม') return 'g';
  if (unit === 'กก') return 'kg';
  if (unit === 'ชิ้น') return 'piece';
  return unit;
}

export function parseProduct(line, index) {
  const discountMatch = line.match(/(?:ลด\s*)?([0-9]+(?:\.[0-9]+)?)\s*%\s*$/);
  const percent = discountMatch ? Number(discountMatch[1]) : 0;
  const text = discountMatch ? line.slice(0, discountMatch.index).trim() : line.trim();
  let match = quantityFirst.exec(text);
  let price, quantity, unit;
  if (match) {
    quantity = numeric(match[1]); unit = normalizeUnit(match[2]); price = numeric(match[3]);
  } else {
    match = priceFirst.exec(text);
    if (!match) return null;
    price = numeric(match[1]); quantity = numeric(match[2]); unit = normalizeUnit(match[3]);
  }
  const name = text.slice(0, match.index).trim().replace(/[:：–—-]\s*$/, '') || `สินค้า ${index + 1}`;
  return {id:index,name,price,quantity,unit,packs:1,percent,coupon:0};
}

export function parseComparison(input) {
  const parts = input.split(/\n|\s+(?:vs\.?|เทียบกับ)\s+|\s*;\s*/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return null;
  const products = parts.map(parseProduct);
  if (products.some(p => !p)) return null;
  const groups = products.map(p => p.unit === 'ml' || p.unit === 'l' ? 'volume' : p.unit === 'g' || p.unit === 'kg' ? 'mass' : 'count');
  if (new Set(groups).size !== 1) return null;
  const result = compare(groups[0], products);
  if (result.ranked.length !== products.length) return null;
  return {category:groups[0], products, ranked:result.ranked};
}

export function replyForText(input) {
  const text = String(input || '').trim().slice(0, 2000);
  if (/^(เว็บ|ลิงก์|เปิดเว็บ|website)$/i.test(text)) return `เปิด PriceWise: ${URL}`;
  if (/^(วิธีใช้|ช่วยเหลือ|help|เริ่ม)$/i.test(text)) return HELP;
  const result = parseComparison(text);
  if (!result) return `ยังอ่านรายการไม่ได้ ลองส่งตามตัวอย่างนี้นะ\n\n${HELP}`;
  const {category, ranked} = result;
  const basis = category === 'count' ? 'ชิ้น' : category === 'volume' ? '100 มล.' : '100 กรัม';
  const winner = ranked[0];
  const next = ranked[1];
  const saving = ((next.unitPrice - winner.unitPrice) / next.unitPrice * 100).toFixed(2);
  const rows = ranked.map((p, i) => `${i + 1}. ${p.name}: ${formatMoney(p.unitPrice)}/${basis}`);
  return `🏆 ${winner.name} คุ้มที่สุด\n${rows.join('\n')}\n\nถูกกว่าอันดับ 2 ${saving}% ต่อ${basis}\n\nเทียบเพิ่มเติม: ${URL}`;
}
