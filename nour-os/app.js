import { ING, DEFAULT_RECIPES, DEFAULT_PLAN, ZONES, WORKOUTS, DEFAULT_SCHEDULE, SYMPTOMS, PHASES } from './data.js';
import { kvGet, saveState, saveNow, photoPut, photoDel, photoAll, photoClear, persist } from './store.js';

const VERSION = '1.0.0';
const SCHEMA = 1;

/* ================= utils ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const r0 = v => Math.round(v || 0);
const clone = o => JSON.parse(JSON.stringify(o));
const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const today = () => iso(new Date());
const parse = s => { const [a,b,c] = s.split('-').map(Number); return new Date(a, b-1, c); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return iso(d); };
const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5); // a - b
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmt = (s, o) => parse(s).toLocaleDateString('en-CA', o || {month:'short', day:'numeric'});
const mondayOf = s => addDays(s, -((parse(s).getDay()+6)%7));
const short = n => n.replace(/\s*\(.*\)/, '').split(',')[0];

/* ================= state ================= */
const kItem = (n, zone, key, life, s) => ({id:uid(), n, zone, key:key||'', s:s||'ok', added:today(), eatBy: life ? addDays(today(), life) : null});
function seedKitchen(){
  const L = k => (ING[k] && ING[k].life) || 0;
  const items = [
    ['Chicken breasts','freezer','chickenraw'],['Frozen berry blend','freezer','berries'],['Avocado chunks','freezer','avocado'],['Mixed vegetables','freezer','mixedveg'],
    ['McCain fries','freezer'],['Ice cream tub','freezer'],['Ice cream bars','freezer'],['Bread rolls','freezer'],['Sliced almonds','freezer','almonds'],['White cheese','freezer'],
    ['Yogurt','fridge','greekyog',L('greekyog')],['Protein bread','fridge','protbread',L('protbread')],['Eggs','fridge','egg',L('egg'),'low'],['Labneh','fridge','labneh',L('labneh')],
    ['Leafy greens','fridge','greens',3],['Fruit','fridge','fruit',4],['Cheese slices','fridge','cheese',L('cheese')],['Butter','fridge'],['Leftovers container','fridge','',2],
    ['Pickles','fridge','pickles'],['Pepper paste','fridge'],['Garlic sauce','fridge','',10],['Ketchup','fridge'],['Mustard','fridge'],['Hot sauce','fridge'],
    ['Gatorade Zero','fridge'],['Juice boxes','fridge'],['Coffee creamer','fridge','',12],['Soda cans','fridge'],
    ['Vermicelli','spices','vermicelli'],['Flour','spices'],['Tahini','spices','tahini'],['Paprika','spices'],['Garlic powder','spices'],['7 spices','spices'],['Turmeric','spices'],['Coriander','spices'],['Black pepper','spices'],
    ['Rice','abovehood','rice'],['Orange blossom water','abovehood'],['Rose water','abovehood'],['Sugar','abovehood'],['Lasagna noodles','abovehood','pasta'],['Oil sprayer','abovehood','oliveoil'],
    ['Chia protein oats','pantry','oats'],['Peanut butter','pantry','pb'],['Parmesan','pantry','parmesan'],['Popcorn kernels','pantry'],['Microwave popcorn','pantry'],['Cooking spray','pantry'],['Chocolate chips','pantry'],['Breton crackers','pantry'],['Chips','pantry'],['Chocolate bar','pantry']
  ];
  return items.map(([n,z,k,life,s]) => kItem(n, z, k, life, s));
}
function defaults(){
  return {
    schema: SCHEMA,
    profile:{name:'Nour', kcal:1400, protein:100, stepGoal:9000, weightKg:60, heightFt:5, heightIn:0, age:26, sex:'f', activity:1.45, cycleLen:28, periodLen:5, classes:['Bungee','Antigravity']},
    schedule: clone(DEFAULT_SCHEDULE),
    plan: clone(DEFAULT_PLAN),
    recipes: clone(DEFAULT_RECIPES),
    kitchen: seedKitchen(),
    grocery: [{id:uid(), n:'Protein powder', key:'whey'},{id:uid(), n:'Cucumbers', key:'cucumber'},{id:uid(), n:'Tomatoes', key:'tomato'}],
    days: {'2026-11-03': {skip:{'class:Bungee':true}}},
    measures: [],
    photos: [],
    stats: {tossed:0, cooked:0}
  };
}
function migrate(s){
  const d = defaults();
  if(!s || typeof s !== 'object') return d;
  const out = {...d, ...s};
  out.profile = {...d.profile, ...(s.profile||{})};
  out.stats = {...d.stats, ...(s.stats||{})};
  for(const k of ['recipes','kitchen','grocery','measures','photos']) if(!Array.isArray(out[k])) out[k] = d[k];
  if(!out.days || typeof out.days !== 'object') out.days = {};
  // future schema upgrades go here: if(out.schema < 2){ ... }
  out.schema = SCHEMA;
  return out;
}
let S = defaults();
const ui = {tab:'home', date:today(), food:'log', gymDay:null, gymView:'log', exChart:'ht', you:'progress', calMonth:today().slice(0,7), calSel:today(), sheet:null};
const photoURLs = {};
function day(d){ const v = S.days[d] || (S.days[d] = {}); v.foods = v.foods || []; v.done = v.done || {}; v.skip = v.skip || {}; v.sets = v.sets || {}; v.sym = v.sym || []; return v; }
const peek = d => S.days[d] || {};
function commit(){ saveState(S); }

/* ================= calculations ================= */
function ingMacros(x){
  if(x.i === 'custom') return [+x.k||0, +x.p||0, +x.c||0, +x.f||0];
  const I = ING[x.i]; if(!I) return [0,0,0,0];
  const g = (+x.q||0) * (x.u === 'unit' && I.u ? I.u[1] : 1);
  return I.m.map(v => v * g / 100);
}
function ingGrams(x){ const I = ING[x.i]; if(!I) return 0; return (+x.q||0) * (x.u === 'unit' && I.u ? I.u[1] : 1); }
function recipeMacros(r){
  const t = (r.ings||[]).reduce((a, x) => { const m = ingMacros(x); return a.map((v,i) => v + m[i]); }, [0,0,0,0]);
  const s = Math.max(1, +r.serv||1); return t.map(v => v / s);
}
const recipe = id => S.recipes.find(r => r.id === id);
function totals(d){
  return (peek(d).foods||[]).reduce((t, x) => { const s = +x.x||1; return {k:t.k+x.k*s, p:t.p+x.p*s, c:t.c+x.c*s, f:t.f+x.f*s}; }, {k:0,p:0,c:0,f:0});
}
function maintenance(){
  const p = S.profile, cm = ((+p.heightFt||0)*12 + (+p.heightIn||0)) * 2.54, w = +p.weightKg||60, a = +p.age||26;
  return Math.round((10*w + 6.25*cm - 5*a + (p.sex === 'f' ? -161 : 5)) * (+p.activity||1.45));
}
function targets(){
  const p = S.profile, k = +p.kcal||1400, pr = +p.protein||100, f = Math.round((+p.weightKg||60) * .75 / 5) * 5;
  return {k, p:pr, f, c: Math.max(60, Math.round((k - pr*4 - f*9) / 4 / 5) * 5), steps: +p.stepGoal||9000};
}
function sessionsFor(d){
  const list = (S.schedule[parse(d).getDay()] || []).map(x => x.t === 'gym'
    ? {key:'gym:'+x.w, t:'gym', w:x.w, n:WORKOUTS[x.w] ? WORKOUTS[x.w].name : 'Gym', opt:!!x.opt, icon:'🏋️'}
    : {key:'class:'+x.n, t:'class', n:x.n, icon: /bungee/i.test(x.n) ? '🪢' : /anti|aerial/i.test(x.n) ? '🎗️' : '✨'});
  const D = peek(d);
  return list.map(s => ({...s, done: !!(D.done && D.done[s.key]), skip: !!(D.skip && D.skip[s.key])}));
}

/* cycle */
function periodStarts(){
  const ds = Object.keys(S.days).filter(d => S.days[d].period).sort();
  return ds.filter(d => !(S.days[addDays(d,-1)] && S.days[addDays(d,-1)].period));
}
function cycleInfo(ref = today()){
  const starts = periodStarts().filter(d => d <= ref);
  const all = periodStarts();
  const gaps = all.slice(1).map((d,i) => diffDays(d, all[i])).filter(g => g >= 18 && g <= 45).slice(-6);
  const len = gaps.length ? Math.round(gaps.reduce((a,b)=>a+b,0) / gaps.length) : (+S.profile.cycleLen||28);
  if(!starts.length) return {len, none:true};
  const last = starts[starts.length-1], cd = diffDays(ref, last) + 1;
  const ov = len - 14, pl = +S.profile.periodLen||5;
  const phase = cd <= pl ? 'menstrual' : cd < ov - 1 ? 'follicular' : cd <= ov + 1 ? 'ovulation' : 'luteal';
  const next = addDays(last, len);
  return {len, last, cd, phase, next, inDays: diffDays(next, ref), late: cd > len};
}
function predictedDays(){
  const c = cycleInfo(); if(c.none) return {pred:new Set(), fert:new Set()};
  const pred = new Set(), fert = new Set(), pl = +S.profile.periodLen||5;
  for(let k = 0; k < 3; k++){
    const st = addDays(c.last, c.len*(k+1));
    for(let i = 0; i < pl; i++) pred.add(addDays(st, i));
    const ov = addDays(c.last, c.len*k + c.len - 14);
    for(let i = -4; i <= 1; i++) fert.add(addDays(ov, i));
  }
  return {pred, fert};
}

/* kitchen */
const food = () => S.kitchen.filter(x => ZONES[x.zone] && ZONES[x.zone].food);
const daysLeft = x => x.eatBy ? diffDays(x.eatBy, today()) : null;
function eatFirst(limit = 5){
  return food().filter(x => x.s !== 'out' && x.eatBy && daysLeft(x) <= limit).sort((a,b) => daysLeft(a) - daysLeft(b));
}
function haveKey(k){ return S.kitchen.find(x => x.key === k && x.s !== 'out'); }
function suggestions(){
  return S.recipes.map(r => {
    const keys = [...new Set((r.ings||[]).filter(x => x.i !== 'custom').map(x => x.i))];
    const eq = k => [k, k === 'chicken' ? 'chickenraw' : k === 'chickenraw' ? 'chicken' : null].filter(Boolean);
    const have = [], missing = [], expiring = [];
    keys.forEach(k => { const it = eq(k).map(haveKey).find(Boolean); if(it){ have.push(k); const dl = daysLeft(it); if(dl !== null && dl <= 3) expiring.push({it, dl}); } else missing.push(k); });
    const left = S.kitchen.find(x => x.rid === r.id && x.portions > 0);
    const score = (keys.length ? have.length / keys.length : 0) * 10 + expiring.length * 4 + (left ? 20 : 0) - missing.length * 2;
    return {r, have, missing, expiring, left, score};
  }).sort((a,b) => b.score - a.score);
}
function lifeFor(zone, key){
  if(zone === 'fridge') return (ING[key] && ING[key].life) || ZONES.fridge.life;
  return 0;
}
function matchKey(n){
  const l = n.toLowerCase();
  const alias = {yogurt:'greekyog', yoghurt:'greekyog', chicken:'chickenraw', beef:'beef', egg:'egg', rice:'rice', cucumber:'cucumber', tomato:'tomato', berr:'berries', protein:'whey', tahin:'tahini', labneh:'labneh', apple:'apple', banana:'banana', pickle:'pickles', avocado:'avocado', tuna:'tuna', lentil:'lentils', chickpea:'chickpeas', hummus:'hummus', pita:'pita', bread:'protbread', oat:'oats', milk:'milk', cheese:'cheese', halloumi:'halloumi', spinach:'greens', lettuce:'greens', potato:'potato', pasta:'pasta', fish:'fish', almond:'almonds'};
  const hit = Object.keys(alias).find(a => l.includes(a));
  return hit ? alias[hit] : '';
}
function zoneFor(key){
  if(['berries','mixedveg'].includes(key)) return 'freezer';
  if(ING[key] && ING[key].life) return 'fridge';
  return key ? 'pantry' : 'fridge';
}
function addToGrocery(n, key){
  if(S.grocery.some(g => (key && g.key === key) || g.n.toLowerCase() === n.toLowerCase())) return false;
  S.grocery.push({id:uid(), n, key:key||''}); return true;
}

/* gym */
const wNum = w => { const s = String(w||''); const nums = s.match(/\d+(\.\d+)?/g); if(!nums) return 0; return s.includes('+') ? nums.reduce((a,b)=>a+ +b,0) : Math.max(...nums.map(Number)); };
function exHistory(exId){
  return Object.keys(S.days).sort().map(d => { const sets = (S.days[d].sets||{})[exId] || []; const best = Math.max(0, ...sets.map(s => s ? wNum(s.w) : 0)); return best ? {d, v:best} : null; }).filter(Boolean);
}
function allExercises(){ return Object.values(WORKOUTS).flatMap(w => w.ex).filter(e => !['walk','plank','lg','apu2'].includes(e.id)); }

/* ================= charts ================= */
function rings(vals){
  const R = [62,48,34], cols = ['var(--rose)','var(--mint)','var(--amber)'];
  return `<svg viewBox="0 0 150 150" role="img" aria-label="Calories, protein and steps rings">${vals.map((v,i) => {
    const r = R[i], C = 2*Math.PI*r, p = Math.max(0, Math.min(1, v||0));
    return `<circle cx="75" cy="75" r="${r}" fill="none" stroke="${cols[i]}" stroke-opacity=".16" stroke-width="12"/>
      <circle cx="75" cy="75" r="${r}" fill="none" stroke="${cols[i]}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-p)).toFixed(1)}" transform="rotate(-90 75 75)"/>`;
  }).join('')}</svg>`;
}
function lineChart(pts, {unit='', color='var(--rose)', h=120} = {}){
  if(pts.length < 2) return `<div class="empty">${pts.length ? 'One entry so far. Add another to see the line.' : 'Nothing logged yet.'}</div>`;
  const W = 320, pad = 26, ys = pts.map(p => p.v), mn = Math.min(...ys), mx = Math.max(...ys), span = (mx - mn) || 1;
  const lo = mn - span*.15, hi = mx + span*.15;
  const X = i => pad + i * ((W - pad*1.6) / (pts.length - 1)), Y = v => 12 + (h - 34) * (1 - (v - lo) / (hi - lo));
  const d = pts.map((p,i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  const last = pts[pts.length-1], li = pts.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Trend">
    ${[mn, mx].map(v => `<line x1="${pad}" x2="${W-6}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="2" y="${(Y(v)+4).toFixed(1)}" font-size="10" fill="var(--muted)">${+v.toFixed(1)}</text>`).join('')}
    <path d="${d} L${X(li).toFixed(1)} ${h-22} L${pad} ${h-22} Z" fill="${color}" opacity=".12"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p,i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${i===li?5:3}" fill="${color}"/>`).join('')}
    <text x="${pad}" y="${h-6}" font-size="10" fill="var(--muted)">${fmt(pts[0].d)}</text>
    <text x="${W-6}" y="${h-6}" font-size="10" fill="var(--muted)" text-anchor="end">${fmt(last.d)} · ${+last.v.toFixed(1)}${unit}</text>
  </svg>`;
}
function weekBars(){
  const mon = mondayOf(ui.date), T = targets(), W = 320, H = 130, bw = 26;
  const vals = [...Array(7)].map((_,i) => { const d = addDays(mon, i); const t = totals(d); return {d, k:t.k, p:t.p, gym: sessionsFor(d).some(s => s.done)}; });
  const mx = Math.max(T.k * 1.25, ...vals.map(v => v.k)), Y = v => 14 + (H - 44) * (1 - v / mx), x = i => 14 + i * ((W - 28 - bw) / 6);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories this week">
    <line x1="8" x2="${W-8}" y1="${Y(T.k).toFixed(1)}" y2="${Y(T.k).toFixed(1)}" stroke="var(--muted)" stroke-dasharray="4 4"/>
    <text x="${W-8}" y="${(Y(T.k)-4).toFixed(1)}" font-size="10" fill="var(--muted)" text-anchor="end">${T.k} kcal</text>
    ${vals.map((v,i) => { const top = Y(v.k), over = v.k > T.k * 1.05;
      return `<rect x="${x(i).toFixed(1)}" y="${top.toFixed(1)}" width="${bw}" height="${(H-30-top).toFixed(1)}" rx="7" fill="${v.k ? (over ? 'var(--amber)' : 'var(--rose)') : 'var(--line)'}" ${v.k?'':'opacity=".5"'}/>
        <text x="${(x(i)+bw/2).toFixed(1)}" y="${H-16}" font-size="10" font-weight="700" fill="${v.d===today()?'var(--rose)':'var(--muted)'}" text-anchor="middle">${DOW[parse(v.d).getDay()][0]}</text>
        <circle cx="${(x(i)+bw/2).toFixed(1)}" cy="${H-5}" r="3.5" fill="${v.p >= T.p*.9 ? 'var(--mint)' : 'var(--line)'}"/>
        ${v.gym ? `<text x="${(x(i)+bw/2).toFixed(1)}" y="${(top-4).toFixed(1)}" font-size="10" text-anchor="middle">💪</text>` : ''}`; }).join('')}
  </svg>`;
}

/* ================= views ================= */
function render(){
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  $('#view').innerHTML = ({home:vHome, food:vFood, kitchen:vKitchen, gym:vGym, you:vYou})[ui.tab]();
  renderSheet();
}
function weekStrip(){
  const mon = mondayOf(ui.date), T = targets();
  return `<div class="spread"><button class="iconbtn" data-a="wk" data-n="-7" aria-label="Previous week"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <div class="week" style="flex:1">${[...Array(7)].map((_,i) => { const d = addDays(mon,i), t = totals(d), ses = sessionsFor(d);
      return `<button class="wd ${d===today()?'today':''}" data-a="date" data-d="${d}" aria-pressed="${d===ui.date}" aria-label="${fmt(d,{weekday:'long',month:'long',day:'numeric'})}">
        <span class="w">${DOW[parse(d).getDay()].slice(0,2)}</span><span class="n num">${parse(d).getDate()}</span>
        <span class="dots"><i style="${t.p>=T.p*.9?'background:var(--mint)':''}"></i><i style="${ses.some(s=>s.done)?'background:var(--rose)':''}"></i><i style="${peek(d).period?'background:var(--lilac)':''}"></i></span></button>`; }).join('')}</div>
    <button class="iconbtn" data-a="wk" data-n="7" aria-label="Next week"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>`;
}
function mealTiles(){
  const plan = S.plan[parse(ui.date).getDay()] || {};
  const planned = new Set(['B','L','D','S'].map(k => plan[k]).filter(Boolean));
  const order = [...S.recipes].sort((a,b) => (planned.has(b.id) - planned.has(a.id)));
  const lefts = S.kitchen.filter(x => x.rid && x.portions > 0);
  return `<div class="tiles">
    ${lefts.map(x => `<button class="tile" data-a="eatleft" data-id="${x.id}"><span class="plus">+</span><span class="ti" style="background:var(--amber-soft)">🍱</span><span class="tn pad">${esc(short(x.n))}</span><span class="ts">Leftovers · ${x.portions} left</span></button>`).join('')}
    ${order.map(r => { const m = recipeMacros(r); return `<button class="tile ${planned.has(r.id)?'plan':''}" data-a="log" data-id="${r.id}"><span class="plus">+</span><span class="ti" style="background:var(--rose-soft)">${esc(r.icon||'🍽️')}</span><span class="tn pad">${esc(r.n)}</span><span class="ts num">${planned.has(r.id)?'Planned · ':''}${r0(m[0])} kcal · ${r0(m[1])} g P</span></button>`; }).join('')}
    ${(() => { const y = peek(addDays(ui.date,-1)); return y.foods && y.foods.length ? `<button class="tile" data-a="copyy" style="border-style:dashed"><span class="ti" style="background:var(--mint-soft)">↻</span><span class="tn">Same as yesterday</span><span class="ts num">${r0(totals(addDays(ui.date,-1)).k)} kcal</span></button>` : ''; })()}
    <button class="tile" data-a="quick" style="border-style:dashed"><span class="ti" style="background:var(--raised)">✏️</span><span class="tn">Something else</span><span class="ts">Type the calories</span></button>
  </div>`;
}
function vHome(){
  const T = targets(), t = totals(ui.date), D = peek(ui.date), steps = +D.steps||0, ses = sessionsFor(ui.date), c = cycleInfo(ui.date), ef = eatFirst(4);
  const isToday = ui.date === today();
  const feel = +D.feel||0;
  return `
  <div class="hello"><div><div class="eyebrow">${fmt(ui.date,{weekday:'long',month:'long',day:'numeric'})}</div><h1>${isToday ? 'Hi ' + esc(S.profile.name||'Nour') : 'Looking back'}</h1></div>
    <button class="iconbtn" data-a="settings" aria-label="Settings"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div>
  ${weekStrip()}
  <section class="card"><div class="hero">${rings([t.k/T.k, t.p/T.p, steps/T.steps])}
    <div class="legend">
      <div class="lg"><div class="t" style="color:var(--rose)">Calories</div><div class="v num">${r0(t.k)}<small> / ${T.k}</small></div><div class="tiny ${t.k>T.k?'':'muted'}" style="${t.k>T.k?'color:var(--amber);font-weight:800':''}">${t.k>T.k ? r0(t.k-T.k)+' over' : r0(T.k-t.k)+' left'}</div></div>
      <div class="lg"><div class="t" style="color:var(--mint)">Protein</div><div class="v num">${r0(t.p)}<small> / ${T.p} g</small></div><div class="tiny muted">${t.p >= T.p ? 'Hit it ✓' : r0(T.p-t.p) + ' g to go'}</div></div>
      <div class="lg"><div class="t" style="color:var(--amber)">Steps</div><div class="stepbox"><input id="steps" inputmode="numeric" placeholder="0" value="${esc(D.steps||'')}" aria-label="Steps from Fitbit"></div><div class="tiny muted num">of ${T.steps.toLocaleString()}</div></div>
    </div></div></section>

  <section class="card"><div class="spread"><h3>Today’s plan</h3>${c.none ? `<button class="chip lilac" data-a="tab" data-t="you" data-sub="cycle" style="border:0">Set up cycle</button>` : `<button class="chip ${PHASES[c.phase].c}" data-a="tab" data-t="you" data-sub="cycle" style="border:0">Day ${c.cd} · ${PHASES[c.phase].n}</button>`}</div>
    ${ses.length ? ses.map(s => `<div class="session"><span class="ic" style="background:${s.t==='gym'?'var(--rose-soft)':'var(--lilac-soft)'}">${s.icon}</span>
      <div style="flex:1;min-width:0"><div class="b">${esc(s.n)}${s.opt?' <span class="chip grey">optional</span>':''}</div><div class="tiny muted">${s.skip ? 'Skipped' : s.done ? 'Done ✓' : s.t==='gym' ? WORKOUTS[s.w].ex.length + ' exercises' : 'Class'}</div></div>
      ${s.skip ? `<button class="btn sm" data-a="skip" data-k="${s.key}">Unskip</button>` : s.done ? `<button class="btn sm" data-a="done" data-k="${s.key}">Undo</button>` :
        `${s.t==='gym' ? `<button class="btn sm primary" data-a="opengym" data-w="${s.w}">Start</button>` : `<button class="btn sm primary" data-a="done" data-k="${s.key}">Done</button>`}<button class="btn sm ghost" data-a="skip" data-k="${s.key}">Skip</button>`}
      </div>`).join('') : `<div class="session"><span class="ic" style="background:var(--mint-soft)">🌿</span><div><div class="b">Rest day</div><div class="tiny muted">A walk counts. Aim for your steps.</div></div></div>`}
    ${!c.none ? `<div class="tiny muted">${PHASES[c.phase].tip}</div>` : ''}
    <div><div class="small b" style="margin-bottom:6px">How do you feel?</div><div class="faces">${['😩','😕','😐','🙂','🤩'].map((e,i) => `<button class="face" data-a="feel" data-v="${i+1}" aria-pressed="${feel===i+1}" aria-label="Feeling ${i+1} of 5">${e}</button>`).join('')}</div></div>
  </section>

  ${ef.length ? `<section class="stack"><div class="spread"><h3>Eat me first</h3><button class="link" data-a="tab" data-t="kitchen">Kitchen</button></div>
    <div class="scroller">${ef.map(x => { const dl = daysLeft(x); return `<button class="eat ${dl<=1?'urgent':dl<=3?'soon':''}" data-a="item" data-id="${x.id}">
      <span class="days num" style="color:${dl<=1?'var(--rose)':dl<=3?'var(--amber)':'var(--fg)'}">${dl<0?'Past':dl===0?'Today':dl+'d'}</span><span class="en">${esc(x.n)}</span><span class="tiny muted">${x.portions?x.portions+' portions · ':''}${ZONES[x.zone].n}</span></button>`; }).join('')}</div></section>` : ''}

  <section class="card"><div class="spread"><h3>Log a meal</h3><span class="tiny muted">1 tap = 1 serving</span></div>${mealTiles()}
    ${(D.foods||[]).length ? `<button class="link" data-a="tab" data-t="food">See what you logged (${D.foods.length}) ›</button>` : ''}</section>

  <section class="card"><div class="spread"><h3>This week</h3><span class="tiny muted"><span style="color:var(--mint)">●</span> protein hit · 💪 trained</span></div>${weekBars()}</section>`;
}

function vFood(){
  return `<div class="spread"><h1>Food</h1></div>
  <div class="seg" role="group" aria-label="Food section">${[['log','Log'],['recipes','Recipes'],['prep','Meal prep']].map(([k,l]) => `<button data-a="food" data-v="${k}" aria-pressed="${ui.food===k}">${l}</button>`).join('')}</div>
  ${ui.food==='log' ? vFoodLog() : ui.food==='recipes' ? vRecipes() : vPrep()}`;
}
function vFoodLog(){
  const D = peek(ui.date), T = targets(), t = totals(ui.date);
  const bar = (l, v, g, c) => `<div><div class="spread tiny b"><span>${l}</span><span class="num">${r0(v)} / ${g}${l==='Calories'?'':' g'}</span></div><div style="height:8px;border-radius:9px;background:var(--raised);overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${Math.min(100, v/g*100)}%;background:${c};border-radius:9px"></i></div></div>`;
  return `${weekStrip()}
  <section class="card">${bar('Calories', t.k, T.k, 'var(--rose)')}${bar('Protein', t.p, T.p, 'var(--mint)')}<div class="grid2">${bar('Carbs', t.c, T.c, 'var(--amber)')}${bar('Fat', t.f, T.f, 'var(--lilac)')}</div></section>
  <section class="card"><h3>${ui.date===today()?'Today':fmt(ui.date,{weekday:'long',month:'short',day:'numeric'})}</h3>
    ${(D.foods||[]).length ? `<div>${D.foods.map((x,i) => `<div class="li"><div class="n">${esc(x.n)}<div class="m num">${r0(x.k*(x.x||1))} kcal · ${r0(x.p*(x.x||1))} g protein</div></div>
      <div class="stepper"><button data-a="qty" data-i="${i}" data-n="-0.5" aria-label="Less">−</button><span class="num">${x.x||1}</span><button data-a="qty" data-i="${i}" data-n="0.5" aria-label="More">+</button></div>
      <button class="x" data-a="unlog" data-i="${i}" aria-label="Remove ${esc(x.n)}">×</button></div>`).join('')}</div>` : `<div class="empty">Nothing logged yet. Tap a meal below.</div>`}
  </section>
  <section class="card"><h3>Add</h3>${mealTiles()}</section>`;
}
function vRecipes(){
  return `<div class="spread"><div class="small muted">Tap a recipe to edit it. Every recipe is a one-tap tile on Home.</div><button class="btn sm primary" data-a="newrec">+ New</button></div>
  <section class="card">${S.recipes.map(r => { const m = recipeMacros(r); return `<button class="libtn" data-a="editrec" data-id="${r.id}"><span style="font-size:22px">${esc(r.icon||'🍽️')}</span><span style="flex:1;min-width:0"><span class="b">${esc(r.n)}</span><div class="tiny muted num">${r0(m[0])} kcal · P ${r0(m[1])} · C ${r0(m[2])} · F ${r0(m[3])}${r.serv>1?' · per serving':''}</div></span><span class="muted">›</span></button>`; }).join('') || '<div class="empty">No recipes yet.</div>'}</section>`;
}
function prepNeeds(){
  const count = {};
  for(let wd = 0; wd < 7; wd++){ const p = S.plan[wd] || {}; ['B','L','D','S'].forEach(k => { if(p[k]) count[p[k]] = (count[p[k]]||0) + 1; }); }
  const grams = {};
  Object.entries(count).forEach(([rid, n]) => { const r = recipe(rid); if(!r) return; (r.ings||[]).forEach(x => { if(x.i === 'custom' || !ING[x.i]) return; grams[x.i] = (grams[x.i]||0) + ingGrams(x) * n / Math.max(1, +r.serv||1); }); });
  return {count, grams};
}
function vPrep(){
  const opts = v => `<option value="">—</option>` + S.recipes.map(r => `<option value="${r.id}" ${r.id===v?'selected':''}>${esc(r.n)}</option>`).join('');
  const {count, grams} = prepNeeds();
  const missing = Object.keys(grams).filter(k => !haveKey(k) && !(k==='chicken' && haveKey('chickenraw')));
  const nice = (k, g) => g >= 1000 ? (g/1000).toFixed(1) + ' kg' : r0(g) + ' g';
  return `<section class="card"><div class="spread"><h3>Your week</h3><span class="tiny muted">Breakfast · Lunch · Dinner</span></div>
    <div class="stack">${[1,2,3,4,5,6,0].map(wd => { const p = S.plan[wd] || {}; return `<div class="planrow"><span class="b small">${DOW[wd]}</span>${['B','L','D'].map(k => `<select data-plan="${wd}" data-slot="${k}" aria-label="${DOW[wd]} ${k}">${opts(p[k])}</select>`).join('')}</div>`; }).join('')}</div></section>
  <section class="card"><h3>Sunday cook list</h3>
    <div class="stack">${Object.entries(count).sort((a,b)=>b[1]-a[1]).map(([rid,n]) => recipe(rid) ? `<div class="spread"><span class="b">${esc(recipe(rid).n)}</span><span class="chip rose num">×${n}</span></div>` : '').join('')}</div>
    <div class="small muted">That needs about: ${Object.entries(grams).filter(([k,g]) => g >= 20).sort((a,b)=>b[1]-a[1]).map(([k,g]) => `<b>${nice(k,g)}</b> ${esc(short(ING[k].n).toLowerCase())}${k==='chicken' ? ` (${nice(k,g*1.33)} raw)` : ''}`).join(' · ')}.</div>
    ${missing.length ? `<button class="btn primary" data-a="prepmissing">Add ${missing.length} missing item${missing.length>1?'s':''} to grocery list</button>` : `<span class="chip mint">You have everything ✓</span>`}
  </section>
  <section class="card"><h3>Sunday prep, step by step</h3><ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
    <li>Oven to 220°C. Toss the chicken with shawarma spice, garlic, lemon and a spoon of oil. Bake 22 min.</li>
    <li>Meanwhile, start a pot of rice and boil 10 eggs (9 min).</li>
    <li>Brown the beef with onion, 7 spices and cumin.</li>
    <li>Chop cucumber and tomato. Mix yogurt with crushed garlic.</li>
    <li>Pack 4–5 boxes. Then tap “I cooked this” in Kitchen so leftovers show up with their eat-by dates.</li></ol></section>`;
}

function kitchenSVG(){
  const counts = {}; S.kitchen.forEach(x => { if(x.s !== 'out') counts[x.zone] = (counts[x.zone]||0) + 1; });
  const urgent = {}; eatFirst(2).forEach(x => urgent[x.zone] = true);
  const z = (id, inner, bx, by) => `<g class="zone" data-a="zone" data-z="${id}" tabindex="0" role="button" aria-label="Open ${ZONES[id].n}">${inner}
    ${counts[id] ? `<g pointer-events="none"><circle cx="${bx}" cy="${by}" r="9" fill="${urgent[id]?'var(--rose)':'var(--surface)'}" stroke="var(--line)"/><text x="${bx}" y="${by+3.5}" font-size="10" font-weight="800" text-anchor="middle" fill="${urgent[id]?'var(--on-accent)':'var(--fg)'}">${counts[id]}</text></g>` : ''}</g>`;
  const door = (x,y,w,h,hd='r') => `<rect class="door" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="var(--cab)" stroke="var(--cab-line)"/><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" rx="1.5" fill="none" stroke="var(--cab-line)" pointer-events="none"/>${hd ? `<rect x="${hd==='r'?x+w-8:x+5}" y="${y+h/2-7}" width="2.5" height="14" rx="1" fill="var(--steel-dark)" pointer-events="none"/>` : ''}`;
  return `<svg viewBox="0 0 400 262" role="img" aria-label="Your kitchen">
    <rect x="0" y="0" width="400" height="246" rx="14" fill="var(--sunk)"/>
    <rect x="96" y="126" width="292" height="36" fill="var(--tile)"/>
    <path d="M96 138 q12 -10 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 M96 152 q12 -10 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" fill="none" stroke="var(--cab-line)" stroke-width=".8" opacity=".6"/>
    ${z('abovefridge', door(16,24,38,38,'r') + door(54,24,38,38,''), 85, 30)}
    ${z('freezer', `<rect class="door" x="16" y="66" width="76" height="54" rx="5" fill="var(--steel)" stroke="var(--steel-dark)"/><rect x="21" y="110" width="66" height="3" rx="1" fill="var(--steel-dark)" pointer-events="none"/><rect x="28" y="76" width="14" height="18" rx="1" fill="var(--surface)" pointer-events="none"/><rect x="62" y="76" width="10" height="16" rx="1" fill="var(--rose-soft)" pointer-events="none"/>`, 84, 74)}
    ${z('fridge', `<rect class="door" x="16" y="122" width="76" height="122" rx="5" fill="var(--steel)" stroke="var(--steel-dark)"/><rect x="21" y="127" width="66" height="3" rx="1" fill="var(--steel-dark)" pointer-events="none"/>`, 84, 140)}
    ${z('spices', door(98,36,34,86,'r'), 124, 44)}
    ${z('abovehood', door(134,36,33,46,'r') + door(167,36,33,46,''), 192, 44)}
    <path d="M136 82 h62 l6 14 h-74z" fill="var(--steel)" stroke="var(--steel-dark)"/>
    ${z('cups', door(206,36,36,80,'r') + door(242,36,36,80,'') + door(280,36,34,72,'r') + door(314,36,34,72,'') + door(350,36,38,86,''), 380, 44)}
    <rect x="96" y="160" width="292" height="6" fill="var(--steel)"/>
    ${z('pantry', door(98,166,34,78,'r'), 124, 176)}
    <rect x="134" y="148" width="70" height="96" rx="3" fill="var(--steel)" stroke="var(--steel-dark)"/><rect x="134" y="148" width="70" height="12" fill="var(--steel-dark)"/><rect x="141" y="176" width="56" height="42" rx="2" fill="var(--bg)" opacity=".8"/>
    <rect x="206" y="166" width="38" height="78" fill="var(--cab)" stroke="var(--cab-line)"/><rect x="244" y="166" width="70" height="78" fill="var(--cab)" stroke="var(--cab-line)"/><rect x="314" y="166" width="74" height="78" fill="var(--cab)" stroke="var(--cab-line)"/>
    <rect x="262" y="158" width="40" height="5" rx="2" fill="var(--steel-dark)"/><path d="M282 158 v-22 q0 -6 8 -6 h6" fill="none" stroke="var(--steel-dark)" stroke-width="2.5"/>
    <rect x="338" y="136" width="46" height="22" rx="2" fill="var(--bg)" opacity=".9"/><rect x="370" y="142" width="10" height="4" fill="var(--mint)"/>
    <rect x="212" y="172" width="72" height="5" rx="2" fill="var(--wood)"/>
  </svg>`;
}
function vKitchen(){
  const ef = eatFirst(7), sug = suggestions().slice(0, 4);
  return `<div class="spread"><h1>Kitchen</h1><button class="btn sm" data-a="additem">+ Add food</button></div>
  <section class="card kitchen" style="padding:10px">${kitchenSVG()}<div class="tiny muted" style="padding:0 6px 4px">Tap the fridge, freezer or a cabinet. Pink badges mean something is about to go bad.</div></section>
  <section class="card"><div class="spread"><h3>Eat me first</h3><span class="tiny muted">next 7 days</span></div>
    ${ef.length ? ef.map(x => { const dl = daysLeft(x); return `<button class="libtn" data-a="item" data-id="${x.id}"><span class="chip ${dl<=1?'rose':dl<=3?'amber':'grey'} num" style="min-width:58px;justify-content:center">${dl<0?'Past':dl===0?'Today':dl+' days'}</span><span style="flex:1;min-width:0" class="b">${esc(x.n)}<div class="tiny muted" style="font-weight:500">${x.portions?x.portions+' portions · ':''}${ZONES[x.zone].n}</div></span><span class="muted">›</span></button>`; }).join('') : `<div class="empty">Nothing going bad this week.</div>`}</section>
  <section class="card"><h3>Cook from what you have</h3>
    ${sug.map(({r, missing, expiring, left}) => `<div class="li" style="align-items:flex-start"><span style="font-size:24px">${esc(r.icon||'🍽️')}</span><div class="n">${esc(r.n)}
      <div class="row" style="gap:6px;margin-top:6px">${left ? `<span class="chip amber">${left.portions} leftover${left.portions>1?'s':''} ready</span>` : ''}${expiring.map(e => `<span class="chip rose">uses ${esc(short(e.it.n).toLowerCase())} · ${e.dl<=0?'today':e.dl+'d'}</span>`).join('')}${missing.length ? `<span class="chip grey">need ${esc(missing.map(k => short(ING[k].n).toLowerCase()).join(', '))}</span>` : `<span class="chip mint">all in stock</span>`}</div></div>
      <button class="btn sm ${missing.length?'':'primary'}" data-a="cook" data-id="${r.id}">Cook</button></div>`).join('')}</section>
  <section class="card"><div class="spread"><h3>Grocery list</h3>${S.grocery.length ? `<span class="tiny muted">tick = bought</span>` : ''}</div>
    ${S.grocery.length ? `<div>${S.grocery.map(g => `<div class="li" style="padding:0"><label class="check" style="flex:1"><input type="checkbox" data-a="buy" data-id="${g.id}"><span>${esc(g.n)}</span></label><button class="x" data-a="ungrocery" data-id="${g.id}" aria-label="Remove ${esc(g.n)}">×</button></div>`).join('')}</div>` : `<div class="empty">List is empty.</div>`}
    <form data-f="grocery" class="row" style="flex-wrap:nowrap"><input name="n" placeholder="Add an item" aria-label="Add to grocery list" autocomplete="off"><button class="btn">Add</button></form></section>`;
}

function vGym(){
  const ses = sessionsFor(ui.date), sched = ses.find(s => s.t === 'gym');
  const k = ui.gymDay || (sched && sched.w) || 'd1'; ui.gymDay = k;
  const mon = mondayOf(ui.date);
  const weekRow = [...Array(7)].map((_,i) => { const d = addDays(mon,i), ss = sessionsFor(d); return `<button class="wd ${d===today()?'today':''}" data-a="date" data-d="${d}" aria-pressed="${d===ui.date}"><span class="w">${DOW[parse(d).getDay()].slice(0,2)}</span><span style="font-size:15px;line-height:1.2">${ss.length ? ss.map(s => s.skip ? '⏭️' : s.done ? '✅' : s.icon).join('') : '🌿'}</span></button>`; }).join('');
  return `<div class="spread"><h1>Gym</h1><span class="chip grey">${fmt(ui.date,{weekday:'short',month:'short',day:'numeric'})}</span></div>
  <div class="week">${weekRow}</div>
  <div class="seg">${[['log','Log workout'],['progress','Progress']].map(([v,l]) => `<button data-a="gymview" data-v="${v}" aria-pressed="${ui.gymView===v}">${l}</button>`).join('')}</div>
  ${ui.gymView === 'log' ? gymLog(k, ses) : gymProgress()}`;
}
function gymLog(k, ses){
  const W = WORKOUTS[k], D = peek(ui.date), done = !!(D.done && D.done['gym:'+k]);
  const classes = ses.filter(s => s.t === 'class');
  return `${classes.map(s => `<section class="card"><div class="session" style="padding:0;background:transparent"><span class="ic" style="background:var(--lilac-soft)">${s.icon}</span><div style="flex:1"><div class="b">${esc(s.n)} class</div><div class="tiny muted">${s.skip?'Skipped':s.done?'Done ✓':'Today'}</div></div>
      ${s.skip ? `<button class="btn sm" data-a="skip" data-k="${s.key}">Unskip</button>` : `<button class="btn sm ${s.done?'':'primary'}" data-a="done" data-k="${s.key}">${s.done?'Undo':'Done'}</button>${s.done?'':`<button class="btn sm ghost" data-a="skip" data-k="${s.key}">Skip</button>`}`}</div></section>`).join('')}
  <div class="seg">${Object.keys(WORKOUTS).map((x,i) => `<button data-a="gymday" data-v="${x}" aria-pressed="${x===k}">Day ${i+1}</button>`).join('')}</div>
  <div><h2>${W.name}</h2></div>
  <div class="note"><b>Coach note.</b> ${W.tip}</div>
  <section class="card">${W.ex.map(e => { const sets = (D.sets||{})[e.id] || [], last = lastFor(e.id); let rows = '';
    for(let i = 0; i < e.sets; i++){ const s = sets[i] || {}; rows += `<span class="sn">${i+1}</span><input data-set="${e.id}" data-i="${i}" data-k="w" placeholder="lb" value="${esc(s.w)}" aria-label="${esc(e.n)} set ${i+1} weight" autocomplete="off"><input data-set="${e.id}" data-i="${i}" data-k="r" inputmode="numeric" placeholder="reps" value="${esc(s.r)}" aria-label="${esc(e.n)} set ${i+1} reps" autocomplete="off">`; }
    return `<div class="ex"><div><div class="tt">${esc(e.n)}</div><div class="rx">${e.sets} × ${esc(e.rx)}${e.start?' · '+esc(e.start):''}</div>${last?`<div class="last">Last time: ${esc(last)}</div>`:''}</div><div class="sets">${rows}</div></div>`; }).join('')}
    <button class="btn ${done?'':'primary'} wide" data-a="done" data-k="gym:${k}">${done ? 'Workout done ✓ (tap to undo)' : 'Finish workout'}</button></section>
  <div class="tiny muted">Weight can be “25+25” for plates per side.</div>`;
}
function lastFor(exId){
  const ds = Object.keys(S.days).filter(d => d < ui.date && S.days[d].sets && (S.days[d].sets[exId]||[]).some(s => s && (s.w || s.r))).sort();
  if(!ds.length) return null; const d = ds[ds.length-1];
  return fmt(d) + ': ' + S.days[d].sets[exId].filter(x => x && (x.w || x.r)).map(x => `${x.w||'–'}×${x.r||'–'}`).join(', ');
}
function gymProgress(){
  const exs = allExercises(), cur = exs.find(e => e.id === ui.exChart) || exs[0], hist = exHistory(cur.id);
  const prs = exs.map(e => { const h = exHistory(e.id); return h.length ? {e, best: Math.max(...h.map(x => x.v)), first: h[0].v} : null; }).filter(Boolean);
  const mon = mondayOf(today());
  const weeks = [...Array(6)].map((_,i) => { const st = addDays(mon, -7*(5-i)); let n = 0; for(let j=0;j<7;j++){ const D = peek(addDays(st,j)); n += Object.values(D.done||{}).filter(Boolean).length; } return {st, n}; });
  const mx = Math.max(4, ...weeks.map(w => w.n));
  return `<section class="card"><h3>Sessions per week</h3>
    <svg class="chart" viewBox="0 0 320 110" role="img" aria-label="Sessions per week">${weeks.map((w,i) => { const h = (w.n/mx) * 70, x = 14 + i*50;
      return `<rect x="${x}" y="${84-h}" width="34" height="${Math.max(h,2)}" rx="8" fill="${i===5?'var(--rose)':'var(--lilac)'}" opacity="${i===5?1:.7}"/><text x="${x+17}" y="${78-h}" font-size="11" font-weight="800" text-anchor="middle" fill="var(--fg)">${w.n||''}</text><text x="${x+17}" y="102" font-size="10" text-anchor="middle" fill="var(--muted)">${fmt(w.st)}</text>`; }).join('')}</svg></section>
  <section class="card"><div class="spread"><h3>Strength</h3></div>
    <select data-a="exchart" aria-label="Exercise">${exs.map(e => `<option value="${e.id}" ${e.id===cur.id?'selected':''}>${esc(e.n)}</option>`).join('')}</select>
    ${lineChart(hist, {unit:' lb', color:'var(--rose)'})}</section>
  <section class="card"><h3>Personal records</h3>${prs.length ? prs.map(p => `<div class="li"><div class="n">${esc(p.e.n)}<div class="m">started at ${p.first} lb</div></div><span class="chip ${p.best>p.first?'mint':'grey'} num">${p.best} lb${p.best>p.first?' ↑':''}</span></div>`).join('') : `<div class="empty">Log a workout and your records show up here.</div>`}</section>`;
}

function vYou(){
  return `<div class="spread"><h1>You</h1><button class="iconbtn" data-a="settings" aria-label="Settings"><svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg></button></div>
  <div class="seg">${[['progress','Progress'],['cycle','Cycle & mood']].map(([v,l]) => `<button data-a="you" data-v="${v}" aria-pressed="${ui.you===v}">${l}</button>`).join('')}</div>
  ${ui.you === 'progress' ? vProgress() : vCycle()}`;
}
function vProgress(){
  const ws = Object.keys(S.days).filter(d => +S.days[d].weight).sort().map(d => ({d, v:+S.days[d].weight}));
  const m = S.measures.slice().sort((a,b) => a.d < b.d ? -1 : 1), first = m[0], last = m[m.length-1];
  const ph = S.photos.slice().sort((a,b) => a.d < b.d ? -1 : 1);
  const delta = (k) => first && last && first !== last && last[k] && first[k] ? (last[k] - first[k]) : null;
  return `<section class="card"><div class="spread"><h3>Weight</h3><span class="tiny muted">weigh once a week, same morning</span></div>
    ${lineChart(ws.slice(-16), {unit:' kg', color:'var(--rose)'})}
    <form data-f="weight" class="row" style="flex-wrap:nowrap"><input name="w" inputmode="decimal" placeholder="kg today" aria-label="Weight in kg" value="${esc(peek(today()).weight||'')}" autocomplete="off"><button class="btn primary">Save</button></form>
    ${ws.length >= 2 ? `<div class="small"><b>${(ws[ws.length-1].v - ws[0].v).toFixed(1)} kg</b> <span class="muted">since ${fmt(ws[0].d)}</span></div>` : ''}</section>
  <section class="card"><div class="spread"><h3>Measurements (cm)</h3><button class="btn sm" data-a="measure">+ Add</button></div>
    ${last ? `<div class="grid2">${[['waist','Waist'],['hips','Hips'],['thigh','Thigh'],['arm','Arm']].map(([k,l]) => { const dd = delta(k); return `<div class="stat"><span>${l}</span><b>${last[k]||'–'}</b>${dd!==null?`<div class="tiny" style="color:${dd<0?'var(--mint)':'var(--muted)'};font-weight:800">${dd>0?'+':''}${dd.toFixed(1)} since ${fmt(first.d)}</div>`:''}</div>`; }).join('')}</div>`
      : `<div class="empty">Measure waist, hips, thigh and arm every 2–4 weeks. The scale lies more than the tape.</div>`}</section>
  <section class="card"><div class="spread"><h3>Photos</h3><label class="btn sm" for="photoin">+ Add photo</label><input id="photoin" type="file" accept="image/*" hidden data-a="photo"></div>
    ${ph.length >= 2 && photoURLs[ph[0].id] && photoURLs[ph[ph.length-1].id] ? `<div class="compare"><figure><img src="${photoURLs[ph[0].id]}" alt="First photo"><figcaption class="tiny muted">${fmt(ph[0].d)}</figcaption></figure><figure><img src="${photoURLs[ph[ph.length-1].id]}" alt="Latest photo"><figcaption class="tiny muted">${fmt(ph[ph.length-1].d)} · latest</figcaption></figure></div>` : ''}
    ${ph.length ? `<div class="photos">${ph.slice().reverse().map(p => `<button data-a="photoview" data-id="${p.id}" aria-label="Photo from ${fmt(p.d)}">${photoURLs[p.id] ? `<img src="${photoURLs[p.id]}" alt="">` : ''}<span class="d">${fmt(p.d)}</span></button>`).join('')}</div>` : `<div class="empty">Same spot, same light, every 2 weeks. Photos stay on your phone.</div>`}</section>`;
}
function vCycle(){
  const c = cycleInfo(), {pred, fert} = predictedDays();
  const [y, mo] = ui.calMonth.split('-').map(Number), first = new Date(y, mo-1, 1), startPad = (first.getDay()+6)%7, dim = new Date(y, mo, 0).getDate();
  const sel = ui.calSel, SD = peek(sel);
  const feels = Object.keys(S.days).sort().slice(-60).filter(d => S.days[d].feel);
  let pattern = '';
  if(!c.none && feels.length >= 10){
    const byPhase = {}; feels.forEach(d => { const ci = cycleInfo(d); if(ci.none) return; (byPhase[ci.phase] = byPhase[ci.phase] || []).push(+S.days[d].feel); });
    const avg = Object.entries(byPhase).filter(([,v]) => v.length >= 2).map(([k,v]) => [k, v.reduce((a,b)=>a+b,0)/v.length]).sort((a,b) => a[1]-b[1]);
    if(avg.length >= 2) pattern = `You tend to feel lowest in your <b>${PHASES[avg[0][0]].n.toLowerCase()}</b> phase and best in your <b>${PHASES[avg[avg.length-1][0]].n.toLowerCase()}</b> phase.`;
  }
  return `<section class="card">${c.none ? `<div class="b">Tap the days of your last period on the calendar.</div><div class="small muted">The app learns your cycle length from what you log. Predictions are estimates, not medical advice.</div>` :
    `<div class="row" style="gap:16px;flex-wrap:nowrap"><svg viewBox="0 0 90 90" width="90" height="90" aria-hidden="true"><circle cx="45" cy="45" r="36" fill="none" stroke="var(--lilac)" stroke-opacity=".18" stroke-width="10"/><circle cx="45" cy="45" r="36" fill="none" stroke="var(--${PHASES[c.phase].c})" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(2*Math.PI*36).toFixed(1)}" stroke-dashoffset="${(2*Math.PI*36*(1-Math.min(1,c.cd/c.len))).toFixed(1)}" transform="rotate(-90 45 45)"/><text x="45" y="44" text-anchor="middle" font-size="22" font-weight="800" fill="var(--fg)" font-family="Bricolage Grotesque, system-ui">${c.cd}</text><text x="45" y="60" text-anchor="middle" font-size="10" fill="var(--muted)">of ${c.len}</text></svg>
      <div style="min-width:0"><span class="chip ${PHASES[c.phase].c}">${PHASES[c.phase].n} phase</span><div class="b" style="margin-top:6px">${c.late ? `Period is ${c.cd - c.len} day${c.cd-c.len>1?'s':''} late by the estimate` : c.inDays <= 0 ? 'Period could start today' : `Next period in about ${c.inDays} day${c.inDays>1?'s':''}`}</div><div class="tiny muted">${PHASES[c.phase].tip}</div></div></div>`}
    ${pattern ? `<div class="note" style="background:var(--lilac-soft)">${pattern}</div>` : ''}</section>
  <section class="card"><div class="spread"><button class="iconbtn" data-a="calm" data-n="-1" aria-label="Previous month"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><h3>${first.toLocaleDateString('en-CA',{month:'long',year:'numeric'})}</h3><button class="iconbtn" data-a="calm" data-n="1" aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>
    <div class="cal">${['M','T','W','T','F','S','S'].map(h => `<span class="h">${h}</span>`).join('')}${'<span></span>'.repeat(startPad)}${[...Array(dim)].map((_,i) => { const d = iso(new Date(y, mo-1, i+1)), D = peek(d);
      const cls = [D.period?'period':'', !D.period && pred.has(d)?'pred':'', !D.period && fert.has(d)?'fert':'', d===today()?'today':'', d===sel?'sel':''].join(' ');
      return `<button class="cd ${cls}" data-a="calsel" data-d="${d}" aria-label="${fmt(d,{month:'long',day:'numeric'})}${D.period?', period':''}">${i+1}${D.feel?`<span style="position:absolute;bottom:2px;font-size:8px">●</span>`:''}</button>`; }).join('')}</div>
    <div class="row tiny muted" style="gap:12px"><span><span style="color:var(--rose)">■</span> period</span><span><span style="color:var(--rose)">⬚</span> predicted</span><span><span style="color:var(--lilac)">■</span> fertile window</span></div></section>
  <section class="card"><div class="spread"><h3>${sel===today()?'Today':fmt(sel,{weekday:'long',month:'short',day:'numeric'})}</h3>
    <button class="btn sm ${SD.period?'primary':''}" data-a="period" data-d="${sel}">${SD.period ? 'Period ✓' : 'Mark period'}</button></div>
    <div><div class="small b" style="margin-bottom:6px">Feeling</div><div class="faces">${['😩','😕','😐','🙂','🤩'].map((e,i) => `<button class="face" data-a="feel" data-v="${i+1}" data-d="${sel}" aria-pressed="${+SD.feel===i+1}" aria-label="Feeling ${i+1} of 5">${e}</button>`).join('')}</div></div>
    <div><div class="small b" style="margin-bottom:6px">Symptoms</div><div class="pickchips">${SYMPTOMS.map(s => `<button class="pick" data-a="sym" data-v="${s}" data-d="${sel}" aria-pressed="${(SD.sym||[]).includes(s)}">${s}</button>`).join('')}</div></div>
    <form data-f="note" class="stack"><textarea name="t" rows="2" placeholder="A note about today (optional)" aria-label="Note">${esc(SD.note||'')}</textarea><button class="btn sm" style="align-self:flex-start">Save note</button></form></section>`;
}

/* ================= sheets ================= */
function openSheet(s){ ui.sheet = s; renderSheet(); }
function closeSheet(){ ui.sheet = null; renderSheet(); render(); }
function renderSheet(){
  const root = $('#sheetroot'); const s = ui.sheet;
  if(!s){ root.innerHTML = ''; document.body.style.overflow = ''; return; }
  const head = (t) => `<div class="spread"><h2>${t}</h2><button class="btn sm ghost" data-a="close">Close</button></div>`;
  let body = '';
  if(s.type === 'recipe') body = sheetRecipe(s, head);
  if(s.type === 'quick') body = `${head('Something else')}<form data-f="quick" class="stack">
      <label class="stack small b">What was it?<input name="n" required placeholder="e.g. Man’oushe" autocomplete="off"></label>
      <div class="grid2"><label class="stack small b">Calories<input name="k" inputmode="numeric" required></label><label class="stack small b">Protein (g)<input name="p" inputmode="numeric" placeholder="optional"></label></div>
      <label class="check"><input type="checkbox" name="save"><span>Save it as a tile for next time</span></label>
      <button class="btn primary wide">Log it</button></form>`;
  if(s.type === 'zone'){ const Z = ZONES[s.z], items = S.kitchen.filter(x => x.zone === s.z).sort((a,b) => (a.s==='out') - (b.s==='out') || (daysLeft(a) ?? 999) - (daysLeft(b) ?? 999));
    body = `${head(Z.n)}${items.length ? `<div>${items.map(x => { const dl = daysLeft(x); return `<button class="libtn" data-a="item" data-id="${x.id}" style="${x.s==='out'?'opacity:.5':''}"><span style="flex:1;min-width:0" class="b">${esc(x.n)}${x.portions?` <span class="tiny muted">· ${x.portions} portions</span>`:''}</span>
      ${x.s==='out' ? '<span class="chip grey">Out</span>' : x.s==='low' ? '<span class="chip amber">Low</span>' : ''}${dl!==null && x.s!=='out' ? `<span class="chip ${dl<=1?'rose':dl<=3?'amber':'grey'} num">${dl<0?'past':dl===0?'today':dl+'d'}</span>` : ''}<span class="muted">›</span></button>`; }).join('')}</div>` : `<div class="empty">${Z.food ? 'Empty. Add what’s in here.' : 'Cups, plates and pans. Add anything you want to track.'}</div>`}
      <form data-f="zadd" class="row" style="flex-wrap:nowrap"><input name="n" placeholder="Add to ${esc(Z.n.toLowerCase())}" aria-label="Item name" autocomplete="off"><button class="btn primary">Add</button></form>`; }
  if(s.type === 'item'){ const x = S.kitchen.find(i => i.id === s.id); if(!x){ ui.sheet = null; root.innerHTML=''; return; }
    const dl = daysLeft(x);
    body = `${head(esc(x.n))}
      <div class="small muted">${ZONES[x.zone].n}${x.eatBy ? ` · eat by ${fmt(x.eatBy,{weekday:'short',month:'short',day:'numeric'})} (${dl<0?Math.abs(dl)+' days ago':dl===0?'today':dl+' days left'})` : ' · no eat-by date'}</div>
      ${x.portions ? `<button class="btn primary wide" data-a="eatleft" data-id="${x.id}">Ate a portion (${x.portions} left)</button>` : ''}
      <div class="grid2"><button class="btn ${x.portions?'':'primary'}" data-a="used" data-id="${x.id}">Used it up</button><button class="btn" data-a="tossed" data-id="${x.id}">Tossed it 😔</button></div>
      <div><div class="small b" style="margin-bottom:6px">Good until</div><div class="pickchips">${[['Today',0],['2 days',2],['4 days',4],['1 week',7],['2 weeks',14],['1 month',30],['No date',null]].map(([l,n]) => `<button class="pick" data-a="eatby" data-id="${x.id}" data-n="${n===null?'':n}" aria-pressed="${n===null ? !x.eatBy : x.eatBy===addDays(today(),n)}">${l}</button>`).join('')}</div></div>
      <div><div class="small b" style="margin-bottom:6px">How much is left?</div><div class="seg">${[['ok','Plenty'],['low','Low'],['out','Out']].map(([v,l]) => `<button data-a="itemstatus" data-id="${x.id}" data-v="${v}" aria-pressed="${x.s===v}">${l}</button>`).join('')}</div></div>
      <div class="grid2"><label class="stack small b">Name<input data-itemedit="${x.id}" data-k="n" value="${esc(x.n)}" autocomplete="off"></label><label class="stack small b">Where<select data-itemedit="${x.id}" data-k="zone">${Object.entries(ZONES).map(([k,z]) => `<option value="${k}" ${k===x.zone?'selected':''}>${z.n}</option>`).join('')}</select></label></div>
      <button class="btn ghost danger" data-a="delitem" data-id="${x.id}">Delete item</button>`; }
  if(s.type === 'additem') body = `${head('Add food')}<form data-f="additem" class="stack">
      <label class="stack small b">What is it?<input name="n" required placeholder="e.g. Spinach" autocomplete="off"></label>
      <label class="stack small b">Where<select name="zone">${Object.entries(ZONES).filter(([,z])=>z.food).map(([k,z]) => `<option value="${k}" ${k==='fridge'?'selected':''}>${z.n}</option>`).join('')}</select></label>
      <div class="small muted">I’ll guess the eat-by date. You can change it after.</div><button class="btn primary wide">Add</button></form>`;
  if(s.type === 'cook'){ const r = recipe(s.id); const keys = [...new Set((r.ings||[]).filter(x => x.i !== 'custom').map(x => x.i))]; const items = keys.map(k => haveKey(k) || (k==='chicken' && haveKey('chickenraw'))).filter(Boolean);
    body = `${head('Cook ' + esc(r.n))}
      <div class="spread"><span class="b">How many servings are you making?</span><div class="stepper"><button data-a="cookn" data-n="-1" aria-label="Fewer">−</button><span class="num">${s.n}</span><button data-a="cookn" data-n="1" aria-label="More">+</button></div></div>
      <label class="check"><input type="checkbox" id="cooklog" ${s.log?'checked':''} data-a="cooklog"><span>Log 1 serving now</span></label>
      ${s.n - (s.log?1:0) > 0 ? `<div class="note" style="background:var(--mint-soft)">${s.n - (s.log?1:0)} portion${s.n-(s.log?1:0)>1?'s':''} go to your fridge as leftovers, good for 4 days. They show up as one-tap tiles.</div>` : ''}
      ${items.length ? `<div><div class="small b" style="margin-bottom:6px">Did anything run out? Tap it.</div><div class="pickchips">${items.map(x => `<button class="pick" data-a="cookout" data-id="${x.id}" aria-pressed="${s.out.includes(x.id)}">${esc(x.n)}</button>`).join('')}</div><div class="tiny muted" style="margin-top:6px">Anything you tap goes on the grocery list.</div></div>` : ''}
      ${r.how ? `<div class="note"><b>How.</b> ${esc(r.how)}</div>` : ''}
      <button class="btn primary wide" data-a="cookgo">I cooked this</button>`; }
  if(s.type === 'measure') body = `${head('Measurements')}<form data-f="measure" class="stack"><div class="grid2">${[['waist','Waist'],['hips','Hips'],['thigh','Thigh'],['arm','Arm']].map(([k,l]) => `<label class="stack small b">${l} (cm)<input name="${k}" inputmode="decimal" autocomplete="off"></label>`).join('')}</div><div class="tiny muted">Waist at the belly button, hips at the widest point, thigh and arm at the thickest.</div><button class="btn primary wide">Save</button></form>`;
  if(s.type === 'photo'){ const p = S.photos.find(x => x.id === s.id); body = `${head(p ? fmt(p.d,{month:'long',day:'numeric',year:'numeric'}) : 'Photo')}${p && photoURLs[p.id] ? `<img src="${photoURLs[p.id]}" alt="Progress photo" style="border-radius:16px">` : ''}<button class="btn ghost danger" data-a="delphoto" data-id="${s.id}">Delete photo</button>`; }
  if(s.type === 'confirm') body = `${head(esc(s.title))}<div class="small">${esc(s.text)}</div><div class="grid2"><button class="btn" data-a="close">Cancel</button><button class="btn primary" data-a="confirmyes">${esc(s.yes||'Yes')}</button></div>`;
  if(s.type === 'settings') body = sheetSettings(head);
  root.innerHTML = `<div class="scrim" data-a="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-in"><div class="grab"></div>${body}</div></div>`;
  document.body.style.overflow = 'hidden';
}
function sheetRecipe(s, head){
  const r = s.draft, m = recipeMacros(r);
  const opts = v => `<option value="custom" ${v==='custom'?'selected':''}>✏️ Type macros myself</option>` + Object.entries(ING).sort((a,b) => a[1].n.localeCompare(b[1].n)).map(([k,I]) => `<option value="${k}" ${k===v?'selected':''}>${esc(I.n)}</option>`).join('');
  return `${head(s.isNew ? 'New recipe' : 'Edit recipe')}
    <div class="grid2"><label class="stack small b" style="grid-column:1/-1">Name<input data-rec="n" value="${esc(r.n)}" placeholder="e.g. Mom’s mujadara" autocomplete="off"></label>
      <label class="stack small b">Servings it makes<input data-rec="serv" inputmode="numeric" value="${esc(r.serv)}"></label><label class="stack small b">Emoji<input data-rec="icon" value="${esc(r.icon||'')}" maxlength="4" placeholder="🍲"></label></div>
    <h3>Ingredients for the whole recipe</h3>
    <div class="stack">${r.ings.map((x,i) => x.i === 'custom'
      ? `<div class="ing custom"><select data-ing="${i}" data-k="i" style="grid-column:1/-1" aria-label="Ingredient">${opts('custom')}</select><input data-ing="${i}" data-k="n" placeholder="Name" value="${esc(x.n)}" style="grid-column:1/-2" aria-label="Name"><button class="x" data-a="delingr" data-i="${i}" aria-label="Remove">×</button>${['k','p','c','f'].map(k => `<input data-ing="${i}" data-k="${k}" inputmode="decimal" placeholder="${{k:'kcal',p:'Prot g',c:'Carb g',f:'Fat g'}[k]}" value="${esc(x[k])}" aria-label="${k}">`).join('')}</div>`
      : `<div class="ing"><select data-ing="${i}" data-k="i" aria-label="Ingredient">${opts(x.i)}</select><input data-ing="${i}" data-k="q" inputmode="decimal" value="${esc(x.q)}" aria-label="Amount"><select data-ing="${i}" data-k="u" aria-label="Unit"><option value="g">g</option>${ING[x.i] && ING[x.i].u ? `<option value="unit" ${x.u==='unit'?'selected':''}>${esc(ING[x.i].u[0])}</option>` : ''}</select><button class="x" data-a="delingr" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
    <button class="btn sm" data-a="addingr" style="align-self:flex-start">+ Ingredient</button>
    <div class="tiny muted">Per serving</div><div class="totals" id="rtot">${totHTML(m)}</div>
    <label class="stack small b">How to make it (optional)<textarea data-rec="how" rows="2">${esc(r.how||'')}</textarea></label>
    <button class="btn primary wide" data-a="saverec">Save recipe</button>
    ${s.isNew ? '' : `<div class="grid2"><button class="btn" data-a="cook" data-id="${r.id}">Cook it</button><button class="btn ghost danger" data-a="delrec">Delete</button></div>`}`;
}
const totHTML = m => [['kcal',m[0],''],['Protein',m[1],'g'],['Carbs',m[2],'g'],['Fat',m[3],'g']].map(([l,v,u]) => `<div class="stat" style="text-align:center;padding:8px"><b style="font-size:18px">${r0(v)}${u}</b><span>${l}</span></div>`).join('');
function sheetSettings(head){
  const p = S.profile, mt = maintenance();
  const classOpts = [...Object.entries(WORKOUTS).map(([k,w],i) => [`gym:${k}`, `Gym day ${i+1} · ${w.short}`]), ...(p.classes||[]).map(c => [`class:${c}`, `${c} class`])];
  return `${head('Settings')}
  <section class="card"><h3>Daily targets</h3><div class="grid3">
    <label class="stack small b">Calories<input data-prof="kcal" inputmode="numeric" value="${esc(p.kcal)}"></label>
    <label class="stack small b">Protein g<input data-prof="protein" inputmode="numeric" value="${esc(p.protein)}"></label>
    <label class="stack small b">Steps<input data-prof="stepGoal" inputmode="numeric" value="${esc(p.stepGoal)}"></label></div>
    <div class="tiny muted">Your maintenance is about ${mt} kcal, so ${p.kcal} is a ${mt - p.kcal} kcal daily deficit. Protein sweet spot for you: 100–120 g.</div></section>
  <section class="card"><h3>About you</h3><div class="grid2">
    <label class="stack small b">Name<input data-prof="name" value="${esc(p.name)}"></label><label class="stack small b">Age<input data-prof="age" inputmode="numeric" value="${esc(p.age)}"></label>
    <label class="stack small b">Weight kg<input data-prof="weightKg" inputmode="decimal" value="${esc(p.weightKg)}"></label><label class="stack small b">Height<div class="row" style="flex-wrap:nowrap;gap:6px"><input data-prof="heightFt" inputmode="numeric" value="${esc(p.heightFt)}" aria-label="Feet"><span>ft</span><input data-prof="heightIn" inputmode="numeric" value="${esc(p.heightIn)}" aria-label="Inches"><span>in</span></div></label>
    <label class="stack small b">Cycle length<input data-prof="cycleLen" inputmode="numeric" value="${esc(p.cycleLen)}"></label><label class="stack small b">Period length<input data-prof="periodLen" inputmode="numeric" value="${esc(p.periodLen)}"></label></div></section>
  <section class="card"><h3>Weekly schedule</h3>
    ${[1,2,3,4,5,6,0].map(wd => `<div class="li" style="align-items:flex-start"><span class="b" style="width:40px;padding-top:8px">${DOW[wd]}</span><div style="flex:1;min-width:0" class="stack">
      <div class="pickchips">${(S.schedule[wd]||[]).map((x,i) => `<span class="chip ${x.t==='gym'?'rose':'lilac'}" style="padding-right:4px">${x.t==='gym' ? esc(WORKOUTS[x.w].short) : esc(x.n)}<button class="x" style="width:26px;height:26px;font-size:16px" data-a="schdel" data-wd="${wd}" data-i="${i}" aria-label="Remove">×</button></span>`).join('') || '<span class="tiny muted" style="padding-top:8px">Rest</span>'}</div>
      <select data-schadd="${wd}" aria-label="Add to ${DOW[wd]}"><option value="">+ Add…</option>${classOpts.map(([v,l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div></div>`).join('')}
    <form data-f="newclass" class="row" style="flex-wrap:nowrap"><input name="n" placeholder="New class name (e.g. Pilates)" aria-label="New class name" autocomplete="off"><button class="btn">Add</button></form></section>
  <section class="card"><h3>Your data</h3><div class="small muted">Everything lives on this phone only. Export a backup now and then, especially before switching phones.</div>
    <div class="grid2"><button class="btn primary" data-a="export">Export backup</button><label class="btn" for="importin">Import backup</label></div><input id="importin" type="file" accept="application/json,.json" hidden data-a="import">
    <div class="tiny muted" id="storageinfo">Nour OS ${VERSION}</div></section>`;
}

/* ================= actions ================= */
let undoFn = null, toastT = null;
function toast(msg, undo, label = 'Undo'){
  const el = $('#toast'); el.querySelector('span').textContent = msg; undoFn = undo || null;
  el.querySelector('button').hidden = !undo; el.querySelector('button').textContent = label; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3500);
}
$('#toast button').addEventListener('click', () => { if(undoFn){ undoFn(); undoFn = null; } $('#toast').hidden = true; });

function logRecipe(id, d = ui.date){
  const r = recipe(id); if(!r) return; const m = recipeMacros(r), D = day(d);
  const ex = D.foods.find(f => f.rid === id);
  if(ex){ ex.x = (+ex.x||1) + 1; Object.assign(ex, {k:m[0], p:m[1], c:m[2], f:m[3]}); } else D.foods.push({rid:id, n:r.n, k:m[0], p:m[1], c:m[2], f:m[3], x:1});
  commit(); render();
  toast('Logged ' + r.n, () => { const e = D.foods.find(f => f.rid === id); if(!e) return; if((+e.x||1) > 1) e.x -= 1; else D.foods.splice(D.foods.indexOf(e), 1); commit(); render(); });
}
function removeItem(x){ S.kitchen = S.kitchen.filter(i => i.id !== x.id); }

const A = {
  tab(el){ ui.tab = el.dataset.t; if(el.dataset.sub) ui.you = el.dataset.sub; closeQuiet(); render(); scrollTo(0,0); },
  date(el){ ui.date = el.dataset.d; render(); },
  wk(el){ ui.date = addDays(ui.date, +el.dataset.n); render(); },
  settings(){ openSheet({type:'settings'}); showStorage(); },
  close(){ closeSheet(); },
  food(el){ ui.food = el.dataset.v; render(); },
  you(el){ ui.you = el.dataset.v; render(); },
  gymview(el){ ui.gymView = el.dataset.v; render(); },
  gymday(el){ ui.gymDay = el.dataset.v; render(); },
  opengym(el){ ui.tab = 'gym'; ui.gymView = 'log'; ui.gymDay = el.dataset.w; render(); scrollTo(0,0); },
  log(el){ logRecipe(el.dataset.id); },
  quick(){ openSheet({type:'quick'}); },
  copyy(){ const y = peek(addDays(ui.date,-1)), D = day(ui.date), before = clone(D.foods); D.foods = D.foods.concat(clone(y.foods)); commit(); render(); toast('Copied yesterday', () => { D.foods = before; commit(); render(); }); },
  qty(el){ const x = day(ui.date).foods[+el.dataset.i]; x.x = Math.max(.5, (+x.x||1) + +el.dataset.n); commit(); render(); },
  unlog(el){ const D = day(ui.date), i = +el.dataset.i, [gone] = D.foods.splice(i, 1); commit(); render(); toast('Removed ' + gone.n, () => { D.foods.splice(i, 0, gone); commit(); render(); }); },
  feel(el){ const d = el.dataset.d || ui.date, D = day(d), v = +el.dataset.v; D.feel = D.feel === v ? 0 : v; commit(); render(); },
  done(el){ const D = day(ui.date), k = el.dataset.k; D.done[k] = !D.done[k]; if(D.done[k]) delete D.skip[k]; commit(); render(); if(D.done[k]) toast(k.startsWith('gym') ? 'Workout logged 💪' : 'Class logged ✨'); },
  skip(el){ const D = day(ui.date), k = el.dataset.k; D.skip[k] = !D.skip[k]; if(D.skip[k]) delete D.done[k]; commit(); render(); },
  newrec(){ openSheet({type:'recipe', isNew:true, draft:{id:uid(), n:'', icon:'🍲', serv:1, ings:[{i:'chicken', q:150, u:'g'}]}}); },
  editrec(el){ openSheet({type:'recipe', isNew:false, draft:clone(recipe(el.dataset.id))}); },
  addingr(){ ui.sheet.draft.ings.push({i:'rice', q:1, u:'unit'}); renderSheet(); },
  delingr(el){ ui.sheet.draft.ings.splice(+el.dataset.i, 1); renderSheet(); },
  saverec(){ const r = ui.sheet.draft; r.n = (r.n||'').trim() || 'My recipe'; r.serv = Math.max(1, +r.serv||1); const i = S.recipes.findIndex(x => x.id === r.id); if(i >= 0) S.recipes[i] = r; else S.recipes.push(r); commit(); closeSheet(); toast('Saved. It’s a tile on Home now.'); },
  delrec(){ const id = ui.sheet.draft.id, i = S.recipes.findIndex(x => x.id === id); if(i < 0) return closeSheet(); const [gone] = S.recipes.splice(i, 1); commit(); closeSheet(); toast('Recipe deleted', () => { S.recipes.splice(i, 0, gone); commit(); render(); }); },
  zone(el){ openSheet({type:'zone', z:el.dataset.z}); },
  item(el){ openSheet({type:'item', id:el.dataset.id, back:ui.sheet && ui.sheet.type === 'zone' ? ui.sheet : null}); },
  additem(){ openSheet({type:'additem'}); },
  eatby(el){ const x = S.kitchen.find(i => i.id === el.dataset.id); x.eatBy = el.dataset.n === '' ? null : addDays(today(), +el.dataset.n); commit(); renderSheet(); },
  itemstatus(el){ const x = S.kitchen.find(i => i.id === el.dataset.id); x.s = el.dataset.v; if(x.s === 'out' && addToGrocery(x.n, x.key)) toast('Added ' + x.n + ' to the grocery list'); commit(); renderSheet(); },
  used(el){ const x = S.kitchen.find(i => i.id === el.dataset.id), back = ui.sheet.back; const keep = !!x.key && !x.rid;
    if(keep){ x.s = 'out'; addToGrocery(x.n, x.key); } else removeItem(x);
    commit(); ui.sheet = back; render(); toast(keep ? 'Marked out and added to the grocery list' : 'Nice, nothing wasted'); },
  tossed(el){ const x = S.kitchen.find(i => i.id === el.dataset.id), back = ui.sheet.back; removeItem(x); S.stats.tossed++; if(x.key && !x.rid) addToGrocery(x.n, x.key); commit(); ui.sheet = back; render(); toast('Logged. Next time it’ll show up sooner in Eat me first.'); },
  delitem(el){ const x = S.kitchen.find(i => i.id === el.dataset.id), back = ui.sheet.back, idx = S.kitchen.indexOf(x); removeItem(x); commit(); ui.sheet = back; render(); toast('Deleted ' + x.n, () => { S.kitchen.splice(idx, 0, x); commit(); render(); }); },
  eatleft(el){ const x = S.kitchen.find(i => i.id === el.dataset.id); if(!x) return; const r = recipe(x.rid);
    x.portions--; if(x.portions <= 0) removeItem(x); if(ui.sheet && ui.sheet.type === 'item') ui.sheet = ui.sheet.back;
    if(r) logRecipe(r.id); else { commit(); render(); } },
  cook(el){ const r = recipe(el.dataset.id); openSheet({type:'cook', id:r.id, n:Math.max(1, +r.serv||1) > 1 ? +r.serv : 4, log:true, out:[]}); },
  cookn(el){ ui.sheet.n = Math.max(1, Math.min(14, ui.sheet.n + +el.dataset.n)); renderSheet(); },
  cookout(el){ const o = ui.sheet.out, id = el.dataset.id; ui.sheet.out = o.includes(id) ? o.filter(x => x !== id) : [...o, id]; renderSheet(); },
  cookgo(){ const s = ui.sheet, r = recipe(s.id);
    s.out.forEach(id => { const x = S.kitchen.find(i => i.id === id); if(x){ x.s = 'out'; addToGrocery(x.n, x.key); } });
    const extra = s.n - (s.log ? 1 : 0);
    if(extra > 0){ const ex = S.kitchen.find(x => x.rid === r.id); if(ex){ ex.portions += extra; ex.eatBy = addDays(today(), 4); } else S.kitchen.push({id:uid(), n:r.n + ' (leftovers)', zone:'fridge', key:'', rid:r.id, portions:extra, s:'ok', added:today(), eatBy:addDays(today(), 4)}); }
    S.stats.cooked++; commit(); ui.sheet = null;
    if(s.log) logRecipe(r.id, today()); else render();
    toast(extra > 0 ? `${extra} portion${extra>1?'s':''} saved to the fridge` : 'Logged'); },
  buy(el){ const g = S.grocery.find(x => x.id === el.dataset.id); if(!g) return; const gi = S.grocery.indexOf(g);
    setTimeout(() => { S.grocery.splice(gi, 1);
      const ex = g.key && S.kitchen.find(x => x.key === g.key);
      let made = null;
      if(ex){ ex.s = 'ok'; const life = lifeFor(ex.zone, ex.key); ex.eatBy = life ? addDays(today(), life) : ex.eatBy; }
      else { const key = g.key || matchKey(g.n), zone = zoneFor(key); made = kItem(g.n, zone, key, lifeFor(zone, key)); S.kitchen.push(made); }
      commit(); render(); toast(`${g.n} is in your ${ZONES[(ex||made).zone].n.toLowerCase()}`, () => { S.grocery.splice(gi, 0, g); if(made) removeItem(made); commit(); render(); }); }, 220); },
  ungrocery(el){ S.grocery = S.grocery.filter(x => x.id !== el.dataset.id); commit(); render(); },
  prepmissing(){ const {grams} = prepNeeds(); let n = 0; Object.keys(grams).forEach(k => { if(!haveKey(k) && !(k==='chicken' && haveKey('chickenraw')) && addToGrocery(short(ING[k].n), k)) n++; }); commit(); render(); toast(n ? `Added ${n} to the grocery list` : 'Already on your list'); },
  exchart(){}, // handled on change
  calm(el){ const [y,m] = ui.calMonth.split('-').map(Number); const d = new Date(y, m-1 + +el.dataset.n, 1); ui.calMonth = iso(d).slice(0,7); render(); },
  calsel(el){ ui.calSel = el.dataset.d; render(); },
  period(el){ const D = day(el.dataset.d); D.period = !D.period; commit(); render(); },
  sym(el){ const D = day(el.dataset.d), v = el.dataset.v; D.sym = D.sym.includes(v) ? D.sym.filter(x => x !== v) : [...D.sym, v]; commit(); render(); },
  measure(){ openSheet({type:'measure'}); },
  photoview(el){ openSheet({type:'photo', id:el.dataset.id}); },
  delphoto(el){ const id = el.dataset.id; openSheet({type:'confirm', title:'Delete this photo?', text:'It will be gone from your phone. This can’t be undone.', yes:'Delete', fn: async () => { S.photos = S.photos.filter(p => p.id !== id); await photoDel(id); if(photoURLs[id]) URL.revokeObjectURL(photoURLs[id]); delete photoURLs[id]; commit(); }}); },
  confirmyes(){ const fn = ui.sheet.fn; ui.sheet = null; Promise.resolve(fn && fn()).then(() => render()); },
  schdel(el){ S.schedule[el.dataset.wd].splice(+el.dataset.i, 1); commit(); renderSheet(); },
  export(){ doExport(); }
};
function closeQuiet(){ ui.sheet = null; renderSheet(); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if(el && el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && A[el.dataset.a]){ A[el.dataset.a](el, e); return; }
  const t = e.target.closest('.tabs button'); if(t){ ui.tab = t.dataset.tab; if(t.dataset.tab === 'gym') ui.gymDay = null; ui.sheet = null; render(); scrollTo(0,0); }
});
document.addEventListener('keydown', e => {
  if((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g.zone')){ e.preventDefault(); A.zone(e.target); }
  if(e.key === 'Escape' && ui.sheet) closeSheet();
});
document.addEventListener('input', e => {
  const t = e.target, s = ui.sheet;
  if(s && s.type === 'recipe'){
    if(t.dataset.rec){ s.draft[t.dataset.rec] = t.value; }
    else if(t.dataset.ing != null && !['i','u'].includes(t.dataset.k)){ s.draft.ings[+t.dataset.ing][t.dataset.k] = t.value; }
    else return;
    const el = $('#rtot'); if(el) el.innerHTML = totHTML(recipeMacros(s.draft));
  }
});
document.addEventListener('change', e => {
  const t = e.target, ds = t.dataset, s = ui.sheet;
  if(s && s.type === 'recipe' && ds.ing != null && (ds.k === 'i' || ds.k === 'u')){
    const i = +ds.ing;
    if(ds.k === 'i'){ if(t.value === 'custom') s.draft.ings[i] = {i:'custom', n:'', k:'', p:'', c:'', f:''}; else { const I = ING[t.value]; s.draft.ings[i] = {i:t.value, q: I.u ? 1 : 100, u: I.u ? 'unit' : 'g'}; } }
    else s.draft.ings[i].u = t.value;
    renderSheet(); return;
  }
  if(ds.a === 'buy' || ds.a === 'cooklog'){ if(ds.a === 'cooklog'){ ui.sheet.log = t.checked; renderSheet(); } else A.buy(t); return; }
  if(t.id === 'steps'){ day(ui.date).steps = t.value.replace(/\D/g,''); commit(); render(); return; }
  if(ds.set){ const D = day(ui.date), arr = D.sets[ds.set] = D.sets[ds.set] || []; arr[+ds.i] = {...(arr[+ds.i]||{}), [ds.k]: t.value.trim()}; for(let i = 0; i < arr.length; i++) arr[i] = arr[i] || {}; commit(); return; }
  if(ds.plan != null){ S.plan[ds.plan] = {...(S.plan[ds.plan]||{}), [ds.slot]: t.value}; commit(); render(); return; }
  if(ds.a === 'exchart'){ ui.exChart = t.value; render(); return; }
  if(ds.prof){ const v = ds.prof === 'name' ? t.value : (+t.value || 0); S.profile[ds.prof] = v; commit(); render(); return; }
  if(ds.schadd != null){ if(!t.value) return; const [ty, v] = [t.value.slice(0, t.value.indexOf(':')), t.value.slice(t.value.indexOf(':')+1)]; (S.schedule[ds.schadd] = S.schedule[ds.schadd] || []).push(ty === 'gym' ? {t:'gym', w:v} : {t:'class', n:v}); commit(); renderSheet(); return; }
  if(ds.itemedit){ const x = S.kitchen.find(i => i.id === ds.itemedit); x[ds.k] = ds.k === 'n' ? (t.value.trim() || x.n) : t.value; commit(); renderSheet(); return; }
  if(ds.a === 'photo' && t.files && t.files[0]){ addPhoto(t.files[0]).then(() => { t.value = ''; }); return; }
  if(ds.a === 'import' && t.files && t.files[0]){ doImport(t.files[0]).finally(() => { t.value = ''; }); return; }
});
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, fd = new FormData(f), g = k => String(fd.get(k) || '').trim(), kind = f.dataset.f;
  if(kind === 'quick'){ const n = g('n') || 'Snack', k = +g('k') || 0, p = +g('p') || 0;
    if(fd.get('save')){ S.recipes.push({id:uid(), n, icon:'⭐', serv:1, ings:[{i:'custom', n, k, p, c:0, f:0}]}); }
    day(ui.date).foods.push({n, k, p, c:0, f:0, x:1}); commit(); ui.sheet = null; render(); toast('Logged ' + n); }
  if(kind === 'grocery'){ const n = g('n'); if(!n) return; addToGrocery(n, matchKey(n)); commit(); render(); const inp = document.querySelector('form[data-f="grocery"] input'); if(inp) inp.focus(); }
  if(kind === 'zadd' || kind === 'additem'){ const n = g('n'); if(!n) return; const zone = kind === 'zadd' ? ui.sheet.z : g('zone'), key = matchKey(n);
    S.kitchen.push(kItem(n, zone, key, lifeFor(zone, key))); S.grocery = S.grocery.filter(x => !(key && x.key === key));
    commit(); if(kind === 'additem'){ ui.sheet = null; render(); toast(`Added to ${ZONES[zone].n.toLowerCase()}`); } else { renderSheet(); const inp = document.querySelector('form[data-f="zadd"] input'); if(inp) inp.focus(); } }
  if(kind === 'weight'){ const w = parseFloat(g('w')); if(!w) return; day(today()).weight = w; S.profile.weightKg = w; commit(); render(); toast('Weight saved'); }
  if(kind === 'measure'){ const m = {d:today()}; ['waist','hips','thigh','arm'].forEach(k => { const v = parseFloat(g(k)); if(v) m[k] = v; }); if(Object.keys(m).length < 2) return; S.measures = S.measures.filter(x => x.d !== m.d); S.measures.push(m); commit(); ui.sheet = null; render(); toast('Measurements saved'); }
  if(kind === 'note'){ day(ui.calSel).note = g('t'); commit(); render(); toast('Note saved'); }
  if(kind === 'newclass'){ const n = g('n'); if(!n) return; S.profile.classes = [...new Set([...(S.profile.classes||[]), n])]; commit(); renderSheet(); toast(n + ' added. Pick a day for it above.'); }
});

/* ================= photos & backup ================= */
function compress(file){
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', .82); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('read')); };
    img.src = url;
  });
}
async function addPhoto(file){
  try{ const blob = await compress(file), id = uid(), d = today(); await photoPut({id, d, blob}); S.photos.push({id, d}); photoURLs[id] = URL.createObjectURL(blob); await saveNow(S); render(); toast('Photo saved on your phone'); }
  catch(e){ toast('That photo couldn’t be read. Try a JPG or a screenshot.'); }
}
async function loadPhotos(){ try{ const all = await photoAll(); all.forEach(p => { photoURLs[p.id] = URL.createObjectURL(p.blob); }); }catch(e){} }
const blobToData = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function doExport(){
  try{
    const photos = await photoAll(), data = {app:'nour-os', version:VERSION, exported:new Date().toISOString(), state:S, photos: await Promise.all(photos.map(async p => ({id:p.id, d:p.d, data: await blobToData(p.blob)})))};
    const name = `nour-os-backup-${today()}.json`, file = new File([JSON.stringify(data)], name, {type:'application/json'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], title:'Nour OS backup'}); toast('Backup ready'); return; }catch(e){ if(e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Backup downloaded');
  }catch(e){ toast('Export failed. Try again.'); }
}
async function doImport(file){
  let data; try{ data = JSON.parse(await file.text()); }catch(e){ toast('That file isn’t a Nour OS backup.'); return; }
  if(!data || data.app !== 'nour-os' || !data.state){ toast('That file isn’t a Nour OS backup.'); return; }
  openSheet({type:'confirm', title:'Restore this backup?', text:`It replaces everything on this phone with the backup from ${fmt((data.exported||'').slice(0,10) || today(),{month:'long',day:'numeric',year:'numeric'})}.`, yes:'Restore', fn: async () => {
    S = migrate(data.state); await photoClear(); Object.values(photoURLs).forEach(u => URL.revokeObjectURL(u)); Object.keys(photoURLs).forEach(k => delete photoURLs[k]);
    for(const p of (data.photos||[])){ const blob = await (await fetch(p.data)).blob(); await photoPut({id:p.id, d:p.d, blob}); photoURLs[p.id] = URL.createObjectURL(blob); }
    await saveNow(S); toast('Backup restored'); }});
}
async function showStorage(){
  const el = document.getElementById('storageinfo'); if(!el) return;
  let txt = `Nour OS ${VERSION}`;
  try{ if(navigator.storage && navigator.storage.persisted){ txt += (await navigator.storage.persisted()) ? ' · storage protected ✓' : ' · add to Home Screen to protect storage'; } }catch(e){}
  el.textContent = txt;
}

/* ================= boot ================= */
async function boot(){
  try{ const saved = await kvGet('state'); S = migrate(saved); if(!saved) await saveNow(S); }catch(e){ S = defaults(); }
  await loadPhotos();
  render();
  persist();
  if('serviceWorker' in navigator && location.protocol === 'https:'){
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if(w.state === 'installed' && navigator.serviceWorker.controller) toast('New version ready', () => location.reload(), 'Reload'); }); });
    }).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') saveNow(S).catch(()=>{}); else if(ui.date !== today() && !ui.sheet){ /* new day */ } });
}
window.__nour = {get S(){ return S; }, ui};
boot();
