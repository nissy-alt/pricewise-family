export const unitOptions={volume:['ml','l'],mass:['g','kg'],count:['piece']};
export const unitLabel={ml:'มล.',l:'ลิตร',g:'กรัม',kg:'กก.',piece:'ชิ้น'};
const scale={ml:1,l:1000,g:1,kg:1000,piece:1};
export function formatMoney(amount){return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);}
export function compare(category,products){
  const validUnits=unitOptions[category];
  if(!validUnits || !Array.isArray(products)) return {ranked:[]};
  const ranked=products.flatMap(p=>{
    const price=Number(p.price),quantity=Number(p.quantity),packs=Number(p.packs),percent=Number(p.percent||0),coupon=Number(p.coupon||0);
    if(!validUnits.includes(p.unit)|| !Number.isFinite(price)||price<=0 || !Number.isFinite(quantity)||quantity<=0 || (category==='count'&&!Number.isInteger(quantity)) || !Number.isInteger(packs)||packs<1 || !Number.isFinite(percent)||percent<0||percent>100 || !Number.isFinite(coupon)||coupon<0) return [];
    const netPrice=price*(1-percent/100)-coupon;
    const totalBaseAmount=quantity*scale[p.unit]*packs;
    if(netPrice<=0||!Number.isFinite(totalBaseAmount)||totalBaseAmount<=0)return [];
    const unitPrice=netPrice/totalBaseAmount*(category==='count'?1:100);
    return [{id:p.id,name:String(p.name||''),netPrice,totalBaseAmount,unitPrice}];
  }).sort((a,b)=>a.unitPrice-b.unitPrice);
  return {ranked};
}
