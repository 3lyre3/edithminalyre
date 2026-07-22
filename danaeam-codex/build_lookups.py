#!/usr/bin/env python3
"""
build_lookups.py — Danæam lookup document generator
====================================================
Reads:   lexicon.json, grammar.json, examples.json  (same folder)
Writes:  "Danæam Lexicon Lookup.html", "Danæam Grammar Lookup.html", "index.html"

To expand: add entries to the JSON files (same shape as existing ones),
then run:  python3 build_lookups.py
No dependencies beyond the Python standard library.
"""
import json, html, datetime, pathlib

HERE = pathlib.Path(__file__).parent
TODAY = datetime.date.today().isoformat()

lexicon = json.load(open(HERE / "lexicon.json", encoding="utf-8"))
grammar = json.load(open(HERE / "grammar.json", encoding="utf-8"))
examples = json.load(open(HERE / "examples.json", encoding="utf-8"))

# ---- families: curated kin-groups so related forms travel together ----
FAMILIES = {
 "be": ["bha","is","atá","atáea","eibh","bhies","iostá","aobha","bháya","át"],
 "give / exist": ["gæn","gænyin","gilæn","gænea","iëgæn","gænyinea","iëgænyin","gilænea","iëgilæn"],
 "negation": ["ao","aoa","aobha","æœá","æœá-e","æouain","thúil","niri'thte","sin't","'t","'thte","'ya"],
 "questions": ["scér","scén","scé'ya","scé'thte","glas-","glés-","tha"],
 "imperative": ["Air","Ai'","Ai'lith!","Ai'æ'lith!","Air'ith'lith!","Air'í'lith!","Air'ía'lith!","Ai'en'lith!","auytha"],
 "year series": ["Slár","Ghslár","Ül","Ghül","Sfeith","Ghsfeith","Îæth","Ghîæth","Ínhe","Ghínhe","Raíwil","Ghraíwil","Heatth","Gheatth","As"],
}
for e in lexicon:
    fams = [k for k, v in FAMILIES.items() if e["form"] in v]
    if fams:
        e["families"] = fams

# ---- English synonym rings: query expansion for function words ----
RINGS = [
    {"be","is","are","was","were","am"},
    {"not","no","never","nothing","none","nor","neither","without"},
    {"year","years","yr"},
    {"see","saw","seen"},
    {"say","said","says"},
    {"give","gives","given","gave"},
    {"run","ran"},
    {"eat","ate","eaten"},
    {"speak","spoke","spoken","talk","talked"},
    {"child","children"},
    {"person","people"},
]

CSS = r"""
:root{
 --bg0:#16121F; --bg1:#1B1626; --panel:#241D36; --panel2:#2A2340; --line:#3A3054;
 --ink:#EEE8DC; --dim:#A79DB6; --faint:#7A6F8C; --gold:#E8C664; --gold2:#EBCF78;
 --lav:#B6A6E0; --good:#9AD1A0; --warn:#E0A56B; --seal:#C77BB0;
}
body.light{
 --bg0:#FCF9F1; --bg1:#F5F0E6; --panel:#FFFFFF; --panel2:#EDE5D4; --line:#E0D7C5;
 --ink:#251F2E; --dim:#6B5F80; --faint:#8A7F9C; --gold:#8A6D1A; --gold2:#7A5F14;
 --lav:#5A4D8A; --good:#2E7D46; --warn:#9C5A1E; --seal:#8E4A7E;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg0);color:var(--ink);
 font:16px/1.55 "Iowan Old Style",Georgia,"Times New Roman",serif;
 -webkit-font-smoothing:antialiased}
.sans{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--bg0) 92%,transparent);
 backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:.7rem 1rem .6rem}
.hrow{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;max-width:1100px;margin:0 auto}
h1{font-size:1.12rem;margin:0;letter-spacing:.02em}
h1 .æ{color:var(--gold)}
.sub{color:var(--faint);font-size:.78rem;max-width:1100px;margin:.15rem auto 0}
.searchbox{flex:1;min-width:230px;display:flex;align-items:center;background:var(--panel);
 border:1px solid var(--line);border-radius:10px;padding:.45rem .7rem;gap:.5rem}
.searchbox:focus-within{border-color:var(--gold);box-shadow:0 0 0 2px color-mix(in srgb,var(--gold) 30%,transparent)}
.searchbox input{flex:1;background:none;border:0;outline:0;color:var(--ink);font:inherit;font-size:1.02rem}
.searchbox input::placeholder{color:var(--faint)}
.kbd{color:var(--faint);border:1px solid var(--line);border-radius:5px;padding:0 .35rem;font-size:.72rem}
button{cursor:pointer;font:inherit}
.iconbtn{background:var(--panel);border:1px solid var(--line);color:var(--dim);border-radius:9px;
 padding:.42rem .6rem;font-size:.85rem}
.iconbtn:hover{border-color:var(--gold);color:var(--gold)}
main{max-width:1100px;margin:0 auto;padding:1rem}
.count{color:var(--faint);font-size:.8rem;min-width:5.5ch;text-align:right}
.tier{margin:1.4rem 0 .6rem;display:flex;align-items:baseline;gap:.6rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
.tier h2{font-size:.95rem;margin:0;color:var(--gold);letter-spacing:.04em;text-transform:uppercase}
.tier .n{color:var(--faint);font-size:.78rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:.7rem}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:.75rem .9rem .8rem;
 position:relative;transition:border-color .15s}
.card:hover{border-color:color-mix(in srgb,var(--gold) 55%,var(--line))}
.form{font-size:1.35rem;font-weight:700;letter-spacing:.01em;cursor:copy;display:inline-block}
.form:hover{color:var(--gold2)}
.form .copied{position:absolute;font-size:.68rem;color:var(--good);margin-left:.5rem;top:.4rem}
.gloss{color:var(--gold);font-size:1.02rem;margin-top:.1rem}
.meta{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.45rem}
.badge{font-size:.68rem;letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--line);
 border-radius:99px;padding:.1rem .5rem;color:var(--dim);background:var(--panel2)}
.badge.canon{border-color:color-mix(in srgb,var(--good) 45%,var(--line));color:var(--good)}
.badge.working{border-color:color-mix(in srgb,var(--warn) 50%,var(--line));color:var(--warn)}
.badge.sealed{border-color:color-mix(in srgb,var(--seal) 50%,var(--line));color:var(--seal)}
.notes{color:var(--dim);font-size:.86rem;margin-top:.45rem}
.notes.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.more{background:none;border:0;color:var(--lav);font-size:.76rem;padding:.1rem 0;text-align:left}
.src{color:var(--faint);font-size:.7rem;margin-top:.5rem}
.famrow{margin-top:.5rem;display:flex;flex-wrap:wrap;gap:.3rem;align-items:center}
.famlabel{font-size:.7rem;color:var(--faint)}
.chip{background:var(--panel2);border:1px solid var(--line);color:var(--lav);border-radius:99px;
 padding:.12rem .55rem;font-size:.78rem}
.chip:hover{border-color:var(--gold);color:var(--gold)}
.letteridx{position:sticky;top:64px;z-index:40;background:color-mix(in srgb,var(--bg0) 92%,transparent);
 backdrop-filter:blur(8px);padding:.35rem 0;display:flex;flex-wrap:wrap;gap:.15rem .3rem}
.letteridx a{color:var(--dim);text-decoration:none;font-size:.78rem;padding:.1rem .3rem;border-radius:6px}
.letteridx a:hover{color:var(--gold);background:var(--panel)}
.letterhdr{margin:1.2rem 0 .5rem;color:var(--gold);font-size:1.05rem;border-bottom:1px solid var(--line);
 padding-bottom:.2rem;scroll-margin-top:120px}
.empty{color:var(--faint);text-align:center;padding:3rem 1rem;font-style:italic}
.tabs{display:flex;gap:.4rem;margin:.8rem 0 0}
.tab{background:var(--panel);border:1px solid var(--line);color:var(--dim);border-radius:9px 9px 0 0;
 padding:.4rem .9rem;font-size:.85rem}
.tab[aria-selected="true"]{color:var(--gold);border-bottom-color:var(--bg0);background:var(--bg1)}
.secfilt{display:flex;flex-wrap:wrap;gap:.3rem;margin:.7rem 0}
table.mini{border-collapse:collapse;margin:.5rem 0;font-size:.85rem}
table.mini th,table.mini td{border:1px solid var(--line);padding:.25rem .55rem;text-align:left}
table.mini th{background:var(--panel2);color:var(--gold);font-weight:600}
.converter{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:1rem;margin:1rem 0}
.converter h3{margin:.1rem 0 .6rem;color:var(--gold);font-size:1rem}
.converter input{background:var(--bg1);border:1px solid var(--line);border-radius:8px;color:var(--ink);
 padding:.45rem .7rem;font:inherit;width:12rem}
.converter .out{margin-top:.6rem;font-size:1.15rem;min-height:1.6rem}
.converter .calc{color:var(--faint);font-size:.8rem;margin-top:.2rem}
.quick{margin-top:.6rem;display:flex;flex-wrap:wrap;gap:.3rem;align-items:center}
footer{max-width:1100px;margin:2rem auto;padding:1rem;color:var(--faint);font-size:.75rem;
 border-top:1px solid var(--line)}
@media (max-width:640px){ .form{font-size:1.2rem} h1{font-size:1rem} .letteridx{top:110px} }
"""

# ---- shared JS: folding, tokenising, rings ----
JS_CORE = r"""
const FOLD_EXTRA = {'æ':'ae','Æ':'ae','œ':'oe','Œ':'oe','ł':'l','Ł':'l','þ':'th','Þ':'th','ð':'dh','Ð':'dh'};
function fold(s){
  if(!s) return '';
  let out='';
  for(const ch of s){ out += FOLD_EXTRA[ch] || ch; }
  return out.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
}
function toks(s){ const m = fold(s).match(/[a-z0-9']+/g); return m||[]; }
// light stem variants: raped->{rape,rap}, years->year, building->build;
// never strips "is"/"was"/"has"; "being" keeps its -ing.
function stems(t){
  const out = [t];
  if(t.length>5 && t.endsWith('ing')) out.push(t.slice(0,-3));
  if(t.length>4 && t.endsWith('ed')) out.push(t.slice(0,-1), t.slice(0,-2));
  if(t.length>3 && t.endsWith('s') && !/(ss|is|us)$/.test(t)) out.push(t.slice(0,-1));
  return out;
}
function stoks(s){ return [...new Set(toks(s).flatMap(stems))]; }
const NUMW = {1:'one',2:'two',3:'three',4:'four',5:'five',6:'six',7:'seven',8:'eight',9:'nine',10:'ten',11:'eleven',12:'twelve',13:'thirteen',14:'fourteen',15:'fifteen',16:'sixteen',17:'seventeen',18:'eighteen',19:'nineteen',20:'twenty',21:'twenty-one',27:'twenty-seven',28:'twenty-eight',30:'thirty',40:'forty',43:'forty-three',44:'forty-four',49:'forty-nine',50:'fifty',57:'fifty-seven',58:'fifty-eight',60:'sixty',120:'hundred-twenty'};
const WORD2NUM = {}; for(const [n,w] of Object.entries(NUMW)) WORD2NUM[w]=+n;
const RINGS = __RINGS__;
function ringExpand(qt){
  const set = new Set(qt);
  for(const t of qt){
    if(WORD2NUM[t]!=null){ set.add(String(WORD2NUM[t])); set.add(NUMW[WORD2NUM[t]]); }
    if(NUMW[+t]){ set.add(NUMW[+t]); }
  }
  for(const ring of RINGS){
    const hit = qt.some(t=>ring.includes(t));
    if(hit) ring.forEach(t=>set.add(t));
  }
  return [...set];
}
const TENS = {twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const UNITS = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
function collapseNums(v){
  return v.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[-\s]+(one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (m,a,b)=>String(TENS[a.toLowerCase()]+UNITS[b.toLowerCase()]));
}
function qWordsOf(v){
  return toks(collapseNums(v)).map(t=>{
    const vs = new Set(stems(t));
    ringExpand([t]).forEach(r=>stems(r).forEach(s=>vs.add(s)));
    return [...vs];
  });
}
function copyText(t, el){
  navigator.clipboard.writeText(t).then(()=>{
    const s=document.createElement('span'); s.className='copied sans'; s.textContent='copied';
    el.appendChild(s); setTimeout(()=>s.remove(), 900);
  });
}
document.addEventListener('click', e=>{
  const f = e.target.closest('.form');
  if(f) copyText(f.dataset.copy || f.textContent.trim(), f.parentElement);
  const m = e.target.closest('.more');
  if(m){ const n = m.previousElementSibling; n.classList.toggle('clamp');
         m.textContent = n.classList.contains('clamp') ? 'more…' : 'less'; }
});
function setTheme(mode){
  document.body.classList.toggle('light', mode==='light');
  try{ localStorage.setItem('dan-theme', mode); }catch(e){}
}
(function(){
  let t='dark'; try{ t = localStorage.getItem('dan-theme')||'dark'; }catch(e){}
  setTheme(t);
})();
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
"""

JS_LEXICON = r"""
const DATA = __DATA__;
for(const e of DATA){
  e._g = new Set(stoks(e.gloss));
  e._n = new Set(stoks(e.notes));
  e._f = fold(e.form);
  e._fs = e._f.replace(/[^a-z0-9]/g,'');
  e._t = toks(e.type);
}
const q = document.getElementById('q');
const out = document.getElementById('results');
const count = document.getElementById('count');
q.focus();
document.addEventListener('keydown', e=>{
  if(e.key==='/' && document.activeElement!==q){ e.preventDefault(); q.focus(); q.select(); }
  if(e.key==='Escape' && document.activeElement===q){ q.value=''; run(); q.blur(); }
});
q.addEventListener('input', run);
function cardHTML(e){
  const badges = [];
  if(e.type) badges.push(`<span class="badge sans">${esc(e.type)}</span>`);
  if(e.category) badges.push(`<span class="badge sans">${esc(e.category)}</span>`);
  const st = (e.status||'').toLowerCase();
  if(st.includes('canon')||st.includes('active')) badges.push(`<span class="badge canon sans">${esc(e.status)}</span>`);
  else if(st) badges.push(`<span class="badge working sans">${esc(e.status)}</span>`);
  const fams = (e.families||[]).map(f=>`<button class="chip sans fam" data-fam="${esc(f)}">${esc(f)}</button>`).join('');
  const parents = (e.parents||[]).map(p=>`<button class="chip sans parent" data-p="${esc(p)}">→ ${esc(p)}</button>`).join('');
  const notes = e.notes ? `<div class="notes clamp">${esc(e.notes)}</div>${e.notes.length>180?'<button class="more sans">more…</button>':''}` : '';
  return `<div class="card">
    <span class="form" data-copy="${esc(e.form)}">${esc(e.form)}</span>
    <div class="gloss">${esc(e.gloss)}</div>
    <div class="meta">${badges.join('')}</div>
    ${notes}
    ${fams?`<div class="famrow"><span class="famlabel sans">kin</span>${fams}</div>`:''}
    ${parents?`<div class="famrow"><span class="famlabel sans">under</span>${parents}</div>`:''}
    <div class="src sans">${esc(e.source||'')}</div>
  </div>`;
}
function tierHTML(title, list){
  if(!list.length) return '';
  return `<div class="tier"><h2>${title}</h2><span class="n sans">${list.length}</span></div>
          <div class="grid">${list.map(cardHTML).join('')}</div>`;
}
function run(){
  const v = q.value;
  const qWords = qWordsOf(v);
  if(!qWords.length){ browse(); return; }
  const vf = fold(v), vfs = vf.replace(/[^a-z0-9]/g,'');
  const t1=[], tx=[], t2=[], t3=[];
  for(const e of DATA){
    const glossHit = qWords.every(vs => vs.some(x => e._g.has(x)));
    const formHit = vfs.length>0 && (e._fs.startsWith(vfs) || e._f.includes(vf));
    if(glossHit){ (e.crossref?tx:t1).push(e); continue; }
    if(formHit){ t2.push(e); continue; }
    if(qWords.every(vs => vs.some(x => e._n.has(x)))){ t3.push(e); }
  }
  count.textContent = (t1.length+tx.length+t2.length+t3.length)+' found';
  const h = tierHTML('English matches', t1) +
            tierHTML('Cross-references', tx) +
            tierHTML('Danæam-form matches', t2) +
            tierHTML('Mentioned in notes', t3);
  out.innerHTML = h || '<div class="empty">nothing under that name — yet</div>';
}
function browse(){
  count.textContent = DATA.length + ' entries';
  const byL = new Map();
  for(const e of DATA){
    let L = (e._fs[0]||'#').toUpperCase();
    if(!byL.has(L)) byL.set(L, []);
    byL.get(L).push(e);
  }
  const letters = [...byL.keys()].sort();
  const idx = letters.map(L=>`<a href="#L${L}">${L}</a>`).join('');
  let h = `<div class="letteridx sans">${idx}</div>`;
  for(const L of letters){
    const list = byL.get(L).sort((a,b)=>a._f.localeCompare(b._f));
    h += `<div class="letterhdr" id="L${L}">${L}</div><div class="grid">${list.map(cardHTML).join('')}</div>`;
  }
  out.innerHTML = h;
}
document.addEventListener('click', e=>{
  const f = e.target.closest('.fam');
  if(f){ q.value = f.dataset.fam.split(' / ')[0]; run(); window.scrollTo({top:0}); }
  const p = e.target.closest('.parent');
  if(p){ q.value = p.dataset.p; run(); window.scrollTo({top:0}); }
});
run();
"""

def lexicon_page():
    data_json = json.dumps(lexicon, ensure_ascii=False)
    rings_json = json.dumps([sorted(r) for r in RINGS], ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Danæam — Lexicon Lookup</title>
<!-- generated {TODAY} by build_lookups.py · sources: reference-116, All-Coinages concordance, session 2026-07-21 -->
<style>{CSS}</style>
</head><body>
<header>
 <div class="hrow">
  <h1>Dan<span class="æ">æ</span>am <span class="sub" style="display:inline">· lexicon lookup</span></h1>
  <div class="searchbox"><span>⚲</span>
   <input id="q" type="search" placeholder="English word, or Danæam form…  ( / )" autocomplete="off" spellcheck="false">
  </div>
  <span class="count sans" id="count"></span>
  <button class="iconbtn sans" onclick="location.href='Danæam Grammar Lookup.html'">grammar →</button>
  <button class="iconbtn sans" id="theme" onclick="setTheme(document.body.classList.contains('light')?'dark':'light')">◐</button>
 </div>
</header>
<main id="results"></main>
<footer class="sans">{len(lexicon)} entries · whole-word English matching (type <i>is</i> for the whole be-family; “incident” will not intrude) · click any form to copy it · generated {TODAY} — expand lexicon.json, re-run build_lookups.py</footer>
<script>{JS_CORE.replace('__RINGS__', rings_json)}</script>
<script>{JS_LEXICON.replace('__DATA__', data_json)}</script>
</body></html>"""

JS_GRAMMAR = r"""
const RULES = __RULES__;
const EXAMPLES = __EXAMPLES__;
for(const e of RULES){
  e._t = new Set(stoks(e.title));
  e._b = new Set(stoks(e.body));
  e._s = fold(e.section);
}
const q = document.getElementById('q');
const out = document.getElementById('results');
const count = document.getElementById('count');
const filtRow = document.getElementById('secfilt');
let activeSec = null, tab = 'rules';
const SECTIONS = [...new Set(RULES.map(e=>e.section))];
filtRow.innerHTML = SECTIONS.map(s=>`<button class="chip sans sec" data-s="${esc(s)}">${esc(s)}</button>`).join('');
q.focus();
document.addEventListener('keydown', e=>{
  if(e.key==='/' && document.activeElement!==q){ e.preventDefault(); q.focus(); q.select(); }
  if(e.key==='Escape' && document.activeElement===q){ q.value=''; run(); q.blur(); }
});
q.addEventListener('input', run);
document.getElementById('tabRules').onclick = ()=>{ tab='rules'; activeSec=null; syncTabs(); run(); };
document.getElementById('tabEx').onclick = ()=>{ tab='ex'; syncTabs(); run(); };
function syncTabs(){
  document.getElementById('tabRules').setAttribute('aria-selected', tab==='rules');
  document.getElementById('tabEx').setAttribute('aria-selected', tab==='ex');
  document.getElementById('convwrap').style.display = tab==='rules' ? '' : 'none';
  filtRow.style.display = tab==='rules' ? '' : 'none';
}
document.addEventListener('click', e=>{
  const s = e.target.closest('.sec');
  if(s){ activeSec = activeSec===s.dataset.s ? null : s.dataset.s;
    document.querySelectorAll('.sec').forEach(b=>b.style.borderColor = b.dataset.s===activeSec ? 'var(--gold)' : '');
    run(); }
});
function miniTable(rows){
  if(!rows || !rows.length) return '';
  const head = rows[0].map(c=>`<th>${esc(c)}</th>`).join('');
  const body = rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table class="mini sans"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function ruleCard(e){
  const seal = e.anchor==='s9' ? '<span class="badge sealed sans">sealed room</span>'
             : e.anchor==='s12' ? '<span class="badge working sans">emerging</span>' : '';
  const body = e.body ? `<div class="notes ${e.body.length>260?'clamp':''}">${esc(e.body)}</div>${e.body.length>260?'<button class="more sans">more…</button>':''}` : '';
  return `<div class="card">
    <div style="font-size:.72rem;color:var(--faint)" class="sans">${esc(e.section)}</div>
    <div class="form" style="cursor:default;font-size:1.12rem">${esc(e.title)}</div>
    <div class="meta">${seal}</div>
    ${body}${miniTable(e.table)}
  </div>`;
}
function exCard(e){
  return `<div class="card">
    <div class="form" style="cursor:default;font-size:1.05rem">${esc(e.dan)}</div>
    <div class="notes" style="font-style:italic">${esc(e.literal)}</div>
    <div class="gloss" style="font-size:.95rem">${esc(e.english)}</div>
    <div class="meta"><span class="badge sans">${esc(e.type)}</span></div>
  </div>`;
}
function run(){
  const qWords = qWordsOf(q.value);
  if(tab==='ex'){
    const v = fold(q.value);
    const hits = !v ? EXAMPLES : EXAMPLES.filter(e=>
      fold(e.dan).includes(v) || fold(e.literal).includes(v) || fold(e.english).includes(v));
    count.textContent = hits.length + ' examples';
    out.innerHTML = `<div class="grid">${hits.map(exCard).join('')}</div>` ||
      '<div class="empty">no example answers to that</div>';
    if(!hits.length) out.innerHTML = '<div class="empty">no example answers to that</div>';
    return;
  }
  let pool = RULES;
  if(activeSec) pool = pool.filter(e=>e.section===activeSec);
  if(!qWords.length){
    count.textContent = pool.length + ' rules';
    const groups = new Map();
    for(const e of pool){ if(!groups.has(e.section)) groups.set(e.section,[]); groups.get(e.section).push(e); }
    let h='';
    for(const [sec, list] of groups)
      h += `<div class="tier"><h2>${esc(sec)}</h2><span class="n sans">${list.length}</span></div><div class="grid">${list.map(ruleCard).join('')}</div>`;
    out.innerHTML = h; return;
  }
  const t1=[], t2=[];
  for(const e of pool){
    const titleHit = qWords.every(vs => vs.some(x => e._t.has(x)));
    const bodyHit = qWords.every(vs => vs.some(x => e._b.has(x)));
    if(titleHit) t1.push(e); else if(bodyHit) t2.push(e);
  }
  count.textContent = (t1.length+t2.length)+' rules';
  out.innerHTML =
    (t1.length?`<div class="tier"><h2>By name</h2><span class="n sans">${t1.length}</span></div><div class="grid">${t1.map(ruleCard).join('')}</div>`:'') +
    (t2.length?`<div class="tier"><h2>In the text</h2><span class="n sans">${t2.length}</span></div><div class="grid">${t2.map(ruleCard).join('')}</div>`:'');
  if(!t1.length && !t2.length) out.innerHTML = '<div class="empty">no rule answers to that — perhaps a sealed room</div>';
}
// ---- year-name converter (base 2+30) ----
const STEMS = {9:'Slár',10:'Ghslár',17:'Ül',18:'Ghül',20:'Ghsfeith',21:'Sfeith',27:'Îæth',28:'Ghîæth',43:'Ínhe',44:'Ghínhe',49:'Raíwil',50:'Ghraíwil',57:'Heatth',58:'Gheatth'};
const REV = {}; for(const [v,f] of Object.entries(STEMS)) REV[fold(f)] = +v;
function convYear(){
  const y = parseInt(document.getElementById('yin').value, 10);
  const o = document.getElementById('yout');
  if(isNaN(y) || y<0){ o.textContent='—'; return; }
  const a = Math.floor(y/60), b = y%60;
  const miss = [];
  if(!(a in STEMS)) miss.push(a); if(!(b in STEMS)) miss.push(b);
  if(miss.length){ o.innerHTML = `<span style="color:var(--warn)">stem${miss.length>1?'s':''} awaiting the maker: ${miss.join(', ')}</span>`;
    document.getElementById('ycalc').textContent = `${y} = ${a}×60 + ${b}`; return; }
  const A = STEMS[a], B = STEMS[b];
  const Bbare = B.charAt(0).toLowerCase()+B.slice(1);
  o.innerHTML = `<b>${A}-${Bbare}</b>`;
  document.getElementById('ycalc').textContent = `${y} = ${a}.${b} = ${a}×60 + ${b}`;
}
function convName(){
  const v = document.getElementById('nin').value;
  const o = document.getElementById('nout');
  const parts = v.split(/[-–—\s]+/).filter(Boolean);
  if(parts.length!==2){ o.textContent = 'two places, hyphen-joined: e.g. Ghínhe-îæth'; return; }
  const a = REV[fold(parts[0])], b = REV[fold(parts[1])];
  if(a==null || b==null){ o.innerHTML = '<span style="color:var(--warn)">form not in the attested stems</span>'; return; }
  o.innerHTML = `<b>${a*60+b}</b>`;
  document.getElementById('ncalc').textContent = `${a}.${b} → ${a}×60 + ${b} = ${a*60+b}`;
}
document.getElementById('yin').addEventListener('input', convYear);
document.getElementById('nin').addEventListener('input', convName);
document.addEventListener('click', e=>{
  const qk = e.target.closest('.qk');
  if(qk){ document.getElementById('yin').value = qk.dataset.y; convYear(); }
});
syncTabs(); run();
"""

def grammar_page():
    rules_json = json.dumps(grammar, ensure_ascii=False)
    ex_json = json.dumps(examples, ensure_ascii=False)
    rings_json = json.dumps([sorted(r) for r in RINGS], ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Danæam — Grammar Lookup</title>
<!-- generated {TODAY} by build_lookups.py · sources: reference-116, LDS record, session 2026-07-21 -->
<style>{CSS}</style>
</head><body>
<header>
 <div class="hrow">
  <h1>Dan<span class="æ">æ</span>am <span class="sub" style="display:inline">· grammar lookup</span></h1>
  <div class="searchbox"><span>⚲</span>
   <input id="q" type="search" placeholder="rule, term, or example…  ( / )" autocomplete="off" spellcheck="false">
  </div>
  <span class="count sans" id="count"></span>
  <button class="iconbtn sans" onclick="location.href='Danæam Lexicon Lookup.html'">lexicon →</button>
  <button class="iconbtn sans" id="theme" onclick="setTheme(document.body.classList.contains('light')?'dark':'light')">◐</button>
 </div>
 <div class="hrow">
  <div class="tabs sans">
   <button class="tab" id="tabRules" aria-selected="true">rules & conventions</button>
   <button class="tab" id="tabEx" aria-selected="false">worked examples ({len(examples)})</button>
  </div>
 </div>
</header>
<main>
 <div class="secfilt" id="secfilt"></div>
 <div id="convwrap">
 <div class="converter">
  <h3>Year-name converter · base 2+30</h3>
  <div class="sans" style="display:flex;gap:1rem;flex-wrap:wrap">
   <label>I.T. year <input id="yin" type="number" placeholder="e.g. 2983" style="width:8rem"></label>
   <label>Danæam name <input id="nin" type="text" placeholder="e.g. Ghínhe-îæth" style="width:12rem"></label>
  </div>
  <div class="out sans"><span id="yout"></span> <span id="nout"></span></div>
  <div class="calc sans"><span id="ycalc"></span> <span id="ncalc"></span></div>
  <div class="quick sans"><span style="color:var(--faint);font-size:.75rem">canon:</span>
   <button class="chip qk" data-y="2667">2667 · Changing outlawed</button>
   <button class="chip qk" data-y="2961">2961 · the Oath's end</button>
   <button class="chip qk" data-y="2983">2983 · Bródlainn riots</button>
   <button class="chip qk" data-y="2997">2997 · the present</button>
   <button class="chip qk" data-y="618">618 · the Olympiad</button>
  </div>
 </div>
 </div>
 <div id="results"></div>
</main>
<footer class="sans">{len(grammar)} rules & conventions · {len(examples)} worked examples · sealed rooms and emerging gaps are badged · year converter reads only attested stems — unmade stems report themselves · generated {TODAY}</footer>
<script>{JS_CORE.replace('__RINGS__', rings_json)}</script>
<script>{JS_GRAMMAR.replace('__RULES__', rules_json).replace('__EXAMPLES__', ex_json)}</script>
</body></html>"""

def index_page():
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Danæam — Lookup Index</title>
<style>{CSS}</style>
</head><body>
<header><div class="hrow"><h1>Dan<span class="æ">æ</span>am <span class="sub" style="display:inline">· lookups</span></h1>
<button class="iconbtn sans" onclick="setTheme(document.body.classList.contains('light')?'dark':'light')">◐</button></div></header>
<main>
 <div class="grid" style="margin-top:1rem">
  <div class="card">
   <div class="form" style="cursor:default">Lexicon lookup</div>
   <div class="notes">{len(lexicon)} entries — every coinage, compound, morpheme and year-stem. Whole-word English search: type <i>is</i>, get the be-family, and nothing that merely contains “is”. Click any form to copy it.</div>
   <div class="meta"><button class="chip" onclick="location.href='Danæam Lexicon Lookup.html'">open →</button></div>
  </div>
  <div class="card">
   <div class="form" style="cursor:default">Grammar lookup</div>
   <div class="notes">{len(grammar)} rules & conventions + {len(examples)} worked examples + the year-name converter (base 2+30). Sealed rooms and emerging gaps are badged as such.</div>
   <div class="meta"><button class="chip" onclick="location.href='Danæam Grammar Lookup.html'">open →</button></div>
  </div>
  <div class="card">
   <div class="form" style="cursor:default">Expanding the corpus</div>
   <div class="notes">Add entries to <span class="badge">lexicon.json</span> or <span class="badge">grammar.json</span> (same shape as the existing ones), then run <span class="badge">python3 build_lookups.py</span>. Both pages regenerate whole. Nothing is canon until sealed: Elm rules; the keeper keeps.</div>
  </div>
 </div>
</main>
<footer class="sans">generated {TODAY} · sources: reference-116, All-Coinages concordance, LDS record, session 2026-07-21</footer>
<script>{JS_CORE.replace('__RINGS__','[]')}</script>
</body></html>"""

def main():
    out_dir = HERE
    (out_dir / "Danæam Lexicon Lookup.html").write_text(lexicon_page(), encoding="utf-8")
    (out_dir / "Danæam Grammar Lookup.html").write_text(grammar_page(), encoding="utf-8")
    (out_dir / "index.html").write_text(index_page(), encoding="utf-8")
    print("built:",
          (out_dir / "Danæam Lexicon Lookup.html").stat().st_size,
          (out_dir / "Danæam Grammar Lookup.html").stat().st_size,
          (out_dir / "index.html").stat().st_size)

if __name__ == "__main__":
    main()
