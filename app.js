import { compare, formatMoney, unitOptions, unitLabel } from './pricing.js';

const $ = (selector) => document.querySelector(selector);
const productsElement = $('#products');
const storageKey = 'pricewise:v1';
const historyKey = 'pricewise:history:v1';
const sample = [
  { id: 'sample-a', name: 'ขวด 400 มล.', price: 159, quantity: 400, unit: 'ml', packs: 1, percent: 0, coupon: 0 },
  { id: 'sample-b', name: 'ขวด 500 มล.', price: 184, quantity: 500, unit: 'ml', packs: 1, percent: 0, coupon: 0 }
];
let state = load(storageKey, { category: 'volume', products: sample });
if (!state || !['volume','mass','count'].includes(state.category) || !Array.isArray(state.products) || state.products.length < 2 || state.products.length > 5) state = {category:'volume',products:sample};
let history = load(historyKey, []);
if (!Array.isArray(history)) history = [];
let comparison;
let deferredInstall;

function load(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; }
}
function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function nextId() { return globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2); }
function currentProduct() { return {id:nextId(),name:'',price:'',quantity:'',unit:unitOptions[state.category][0],packs:1,percent:0,coupon:0}; }
function normalizedProducts() {
  return state.products.map(p => ({...p, unit:unitOptions[state.category].includes(p.unit)?p.unit:unitOptions[state.category][0]}));
}
function renderCards() {
  state.products = normalizedProducts();
  productsElement.replaceChildren();
  state.products.forEach((product,index) => {
    const card = $('#productTemplate').content.firstElementChild.cloneNode(true);
    card.dataset.id = product.id;
    card.querySelector('.product-badge').textContent = 'สินค้า ' + (index+1);
    card.querySelector('.remove-button').disabled = state.products.length <= 2;
    for (const unit of unitOptions[state.category]) {
      const option = document.createElement('option'); option.value=unit; option.textContent=unitLabel[unit]; card.querySelector('.unit-input').append(option);
    }
    for (const [key,selector] of [['name','.name-input'],['price','.price-input'],['quantity','.quantity-input'],['unit','.unit-input'],['packs','.pack-input'],['percent','.percent-input'],['coupon','.coupon-input']]) card.querySelector(selector).value = product[key] ?? '';
    if (Number(product.percent)>0 || Number(product.coupon)>0) card.querySelector('details').open = true;
    card.querySelector('.remove-button').addEventListener('click', () => { state.products=state.products.filter(p=>p.id!==product.id); renderAll(); });
    card.addEventListener('input', handleEdit);
    card.addEventListener('change', handleEdit);
    productsElement.append(card);
  });
  $('#productCount').textContent = state.products.length + ' จาก 5 ชิ้น';
  $('#addButton').disabled = state.products.length >= 5;
}
function handleEdit(event) {
  const card=event.currentTarget;
  const product=state.products.find(p=>p.id===card.dataset.id);
  if (!product) return;
  const fieldMap={ 'name-input':'name','price-input':'price','quantity-input':'quantity','unit-input':'unit','pack-input':'packs','percent-input':'percent','coupon-input':'coupon' };
  const key=Array.from(event.target.classList).map(c=>fieldMap[c]).find(Boolean);
  if (!key) return;
  product[key]=event.target.value;
  persist(storageKey,state);
  renderResult();
}
function resultSummary(result) {
  const winner=result.ranked[0];
  const runner=result.ranked[1];
  const saving=runner ? ((runner.unitPrice-winner.unitPrice)/runner.unitPrice*100) : 0;
  const unitText=state.category==='count'?'ชิ้น':state.category==='mass'?'100 กรัม':'100 มล.';
  return {winner,runner,saving,unitText};
}
function renderResult() {
  const cards=productsElement.querySelectorAll('.product-card');
  state.products.forEach((product,i)=>{
    const input=cards[i]?.querySelector('.net-price');
    const price=Number(product.price), percent=Number(product.percent||0), coupon=Number(product.coupon||0);
    const valid=price>0 && percent>=0 && percent<=100 && coupon>=0 && price*(1-percent/100)-coupon>0;
    if(input) input.textContent=valid?formatMoney(price*(1-percent/100)-coupon):'—';
    cards[i]?.classList.remove('winner-card');
  });
  comparison=compare(state.category,state.products);
  const root=$('#result'); root.replaceChildren();
  const validCount=comparison.ranked.length;
  $('#saveButton').disabled=validCount<2;
  $('#shareButton').disabled=validCount<2;
  if(validCount<2){const empty=document.createElement('div');empty.className='empty-result';empty.textContent='กรอกข้อมูลสินค้าอย่างน้อย 2 ชิ้นให้ครบ แล้วผลเทียบราคาจะปรากฏตรงนี้ ✨';root.append(empty);return;}
  const {winner,saving,unitText}=resultSummary(comparison);
  const winnerIndex=state.products.findIndex(p=>p.id===winner.id);
  cards[winnerIndex]?.classList.add('winner-card');
  const wrapper=document.createElement('div');wrapper.className='result-card';
  const top=document.createElement('div');top.className='result-hero';
  top.innerHTML='<span class="trophy" aria-hidden="true">🏆</span><div class="winner-copy"><span class="result-tag">ตัวเลือกคุ้มสุด</span><h3></h3><p></p></div><div class="result-stat">ประหยัดต่อหน่วย<strong></strong>เทียบกับอันดับ 2</div>';
  top.querySelector('h3').textContent=winner.name||'สินค้า '+(winnerIndex+1);
  top.querySelector('p').textContent=formatMoney(winner.unitPrice)+' / '+unitText+' · ราคาสุทธิ '+formatMoney(winner.netPrice);
  top.querySelector('.result-stat strong').textContent=saving.toFixed(2)+'%';
  wrapper.append(top);
  const ranking=document.createElement('div');ranking.className='ranking';
  comparison.ranked.forEach((p,i)=>{
    const row=document.createElement('div');row.className='ranking-row';
    const n=document.createElement('span');n.className='rank-number';n.textContent=i+1;
    const label=document.createElement('span');label.className='rank-name';label.textContent=p.name||'สินค้า '+(state.products.findIndex(s=>s.id===p.id)+1);
    const sub=document.createElement('small');sub.textContent=formatMoney(p.netPrice)+' สุทธิ · '+p.totalBaseAmount.toLocaleString('th-TH')+' '+(state.category==='volume'?'มล.':state.category==='mass'?'กรัม':'ชิ้น');label.append(sub);
    const price=document.createElement('span');price.className='rank-price';price.textContent=formatMoney(p.unitPrice);
    const per=document.createElement('small');per.textContent='/ '+unitText;price.append(per);
    row.append(n,label,price);ranking.append(row);
  });
  wrapper.append(ranking);root.append(wrapper);
}
function renderHistory() {
  const root=$('#historyList');root.replaceChildren();
  if(!history.length){const empty=document.createElement('div');empty.className='empty-history';empty.textContent='ยังไม่มีประวัติ กด “บันทึกผลนี้” หลังเทียบราคาได้เลย';root.append(empty);return;}
  history.slice(0,20).forEach(entry=>{
    const item=document.createElement('div');item.className='history-item';
    const meta=document.createElement('div');meta.className='history-meta';
    const strong=document.createElement('strong');strong.textContent=entry.winnerName+' คุ้มกว่า '+Number(entry.saving).toFixed(2)+'%';
    const small=document.createElement('small');small.textContent=new Date(entry.savedAt).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})+' · '+entry.products.length+' สินค้า';meta.append(strong,small);
    const restore=document.createElement('button');restore.type='button';restore.textContent='เปิดดู';restore.addEventListener('click',()=>{state={category:entry.category,products:entry.products};renderAll();window.scrollTo({top:0,behavior:'smooth'});});
    const remove=document.createElement('button');remove.type='button';remove.className='delete-history';remove.textContent='ลบ';remove.setAttribute('aria-label','ลบประวัติ '+entry.winnerName);remove.addEventListener('click',()=>{history=history.filter(h=>h.id!==entry.id);persist(historyKey,history);renderHistory();});
    item.append(meta,restore,remove);root.append(item);
  });
}
function renderAll(){ $('#category').value=state.category;$('#unitHint').textContent=state.category==='count'?'เปรียบเทียบราคาต่อ 1 ชิ้น':state.category==='mass'?'เปรียบเทียบราคาต่อ 100 กรัม':'เปรียบเทียบราคาต่อ 100 มล.';renderCards();renderResult();renderHistory();persist(storageKey,state); }
function setStatus(message){ $('#status').textContent=message; }
$('#category').addEventListener('change',e=>{state.category=e.target.value;state.products=state.products.map(p=>({...p,unit:unitOptions[state.category][0]}));renderAll();});
$('#addButton').addEventListener('click',()=>{if(state.products.length>=5)return;state.products.push(currentProduct());renderAll();productsElement.lastElementChild?.querySelector('.name-input')?.focus();});
$('#sampleButton').addEventListener('click',()=>{state={category:'volume',products:sample.map(p=>({...p}))};renderAll();setStatus('โหลดตัวอย่างแล้ว: 500 มล. คุ้มกว่า 7.42%');});
$('#saveButton').addEventListener('click',()=>{if(comparison.ranked.length<2)return;const {winner,saving}=resultSummary(comparison);history.unshift({id:nextId(),savedAt:new Date().toISOString(),category:state.category,products:structuredClone(state.products),winnerName:winner.name||'สินค้า',saving});history=history.slice(0,20);if(persist(historyKey,history)){renderHistory();setStatus('บันทึกผลเทียบราคาในเครื่องนี้แล้ว ♡');}else setStatus('บันทึกไม่ได้ เบราว์เซอร์อาจปิดการเก็บข้อมูล');});
$('#shareButton').addEventListener('click',()=>{if(comparison.ranked.length<2)return;const {winner,saving,unitText}=resultSummary(comparison);const lines=['🛒 PriceWise เทียบของคุ้ม',...comparison.ranked.map((p,i)=>`${i+1}. ${p.name||'สินค้า'} — ${formatMoney(p.unitPrice)} / ${unitText} (สุทธิ ${formatMoney(p.netPrice)})`),`🏆 ${winner.name||'สินค้า'} คุ้มที่สุด ประหยัด ${saving.toFixed(2)}% ต่อหน่วยเทียบกับอันดับ 2`];window.open('https://line.me/R/msg/text/?'+encodeURIComponent(lines.join('\n')),'_blank','noopener,noreferrer');});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;$('#installButton').hidden=false;});
$('#installButton').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#installButton').hidden=true;});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
renderAll();
