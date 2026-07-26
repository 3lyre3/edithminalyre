#!/usr/bin/env python3
"""
build_lookups.py — Danæam lookup document generator
====================================================
Reads:   lexicon.json, grammar.json, examples.json  (same folder)
Writes:  "Danæam Lexicon Lookup.html", "Danæam Grammar Lookup.html", "index.html"

To expand: add entries to the JSON files (same shape as existing ones),
then run:  python3 build_lookups.py
No dependencies beyond the Python standard library.

Dressed in the cloth of edithminalyre.com — EB Garamond & Cormorant, the
void/ember/amber palette, fog, grain, cursor-glow, and the shared theme
(localStorage 'theme', data-theme on <html>) so night follows the reader
between the site and the codex. /site.js is loaded for the drifting wisp;
everything degrades gracefully when opened from a bare folder.
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
 "cardinals": ["aint","Ghaint","Raí","ghraí","ainteith","îfy","ghîfy","Yfu","Ghyfu"],
 "indefinites": ["yełíc","uaołíc","æœłíc","ios yelthas","ios uaothas","þiníya","nÿel","yelthurn","yelmá","yelëg","uaothüsýa"],
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

FONTS = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;1,300;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="shortcut icon" href="/favicon.ico">"""

# Set theme before paint — same key and attribute as site.js.
THEME_BOOT = """(function(){
  var h=document.documentElement,s=null;
  try{s=localStorage.getItem('theme');}catch(e){}
  var d=window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(s){h.setAttribute('data-theme',s);}else if(!d){h.setAttribute('data-theme','day');}
})();"""

TOGGLE_BTN = """<button class="theme-toggle" id="codexTheme" aria-label="Toggle theme">
<svg class="sun" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
<svg class="moon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
</button>"""

CSS = r"""
/* ── tokens — carried whole from the house stylesheet ─────────── */
:root{
  --void:#050506; --abyss:#0a0a0c; --deep:#0e0e11; --ink:#131316; --smoke:#1a1a1e;
  --ash:#2a2a2e; --stone:#505058; --bone:#808088; --pale:#a8a8b2; --silver:#c8c8d0;
  --ivory:#e8e8ec; --white:#f8f8fa;
  --ember:#8b4513; --rust:#a05020; --amber:#c07830; --gold:#d89840; --honey:#e8b860;
  --violet:#9a89bd;
  --bg-primary:var(--void); --bg-secondary:var(--deep); --bg-card:var(--abyss);
  --text-primary:var(--pale); --text-secondary:var(--bone); --text-muted:var(--stone);
  --text-heading:var(--ivory); --accent:var(--amber); --accent-dim:var(--rust);
  --border:var(--smoke); --border-light:var(--ink);
  --glow-color:rgba(200,120,48,0.06); --glow-secondary:rgba(100,80,120,0.04);
  --grain-opacity:0.035; --fog-opacity:0.4;
  --font-body:'EB Garamond',Georgia,serif; --font-display:'Cormorant',Georgia,serif;
  --theme-transition:background-color .4s ease,color .4s ease,border-color .4s ease;
}
[data-theme="day"]{
  --void:#faf9f7; --abyss:#f5f4f2; --deep:#efeeec; --ink:#e8e7e5; --smoke:#dddcd9;
  --ash:#c8c7c4; --stone:#8a8987; --bone:#6a6968; --pale:#4a4948; --silver:#3a3938;
  --ivory:#2a2928; --white:#1a1918;
  --ember:#a05830; --rust:#8b4820; --amber:#9a5828; --gold:#805020; --honey:#704818;
  --violet:#5f5183;
  --glow-color:rgba(160,88,48,0.08); --glow-secondary:rgba(80,60,100,0.04);
  --grain-opacity:0.02; --fog-opacity:0.15;
}
[data-theme="day"] body{background:#ece6d6}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--bg-primary)}
body{font-family:var(--font-body);font-size:18px;line-height:1.7;color:var(--text-primary);
  background:var(--bg-primary);min-height:100vh;overflow-x:hidden;position:relative;
  transition:var(--theme-transition)}
/* ── atmosphere: glow, fog, grain, cursor, wisp ───────────────── */
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background:
  radial-gradient(ellipse 120% 60% at 50% -20%,var(--glow-color) 0%,transparent 60%),
  radial-gradient(ellipse 100% 50% at 50% 120%,var(--glow-secondary) 0%,transparent 50%),
  radial-gradient(ellipse 50% 70% at 50% 40%,var(--glow-color) 0%,transparent 70%);
  transition:var(--theme-transition)}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;
  opacity:var(--fog-opacity);background:
  radial-gradient(ellipse 80% 40% at 20% 80%,rgba(20,20,25,.8) 0%,transparent 50%),
  radial-gradient(ellipse 60% 50% at 80% 20%,rgba(15,15,20,.6) 0%,transparent 40%),
  radial-gradient(ellipse 100% 30% at 50% 100%,rgba(10,10,15,.9) 0%,transparent 30%);
  animation:fogDrift 30s ease-in-out infinite alternate;transition:opacity .4s ease}
[data-theme="day"] body::after{background:
  radial-gradient(ellipse 80% 40% at 20% 80%,rgba(200,190,170,.3) 0%,transparent 50%),
  radial-gradient(ellipse 60% 50% at 80% 20%,rgba(180,170,150,.2) 0%,transparent 40%)}
@keyframes fogDrift{0%{transform:translateX(-2%) translateY(0);opacity:var(--fog-opacity)}
  50%{opacity:calc(var(--fog-opacity)*1.2)}
  100%{transform:translateX(2%) translateY(-1%);opacity:calc(var(--fog-opacity)*.9)}}
.grain{position:fixed;top:-50%;left:-50%;width:200%;height:200%;pointer-events:none;
  z-index:1000;opacity:var(--grain-opacity);
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  animation:grainShift .5s steps(10) infinite;transition:opacity .4s ease}
@keyframes grainShift{0%,100%{transform:translate(0,0)}10%{transform:translate(-2%,-2%)}
  20%{transform:translate(2%,2%)}30%{transform:translate(-1%,2%)}40%{transform:translate(2%,-1%)}
  50%{transform:translate(-2%,1%)}60%{transform:translate(1%,-2%)}70%{transform:translate(-1%,-1%)}
  80%{transform:translate(2%,1%)}90%{transform:translate(-2%,2%)}}
.cursor-glow{position:fixed;width:400px;height:400px;border-radius:50%;pointer-events:none;
  z-index:5;background:radial-gradient(circle,var(--glow-color) 0%,transparent 70%);
  transform:translate(-50%,-50%);transition:opacity .3s ease;opacity:0}
body:hover .cursor-glow{opacity:1}
.wisp{position:fixed;top:0;left:0;font-family:var(--font-display);font-size:22px;
  color:var(--accent);opacity:.55;text-shadow:0 0 16px var(--accent),0 0 32px var(--glow-color);
  pointer-events:none;z-index:5;will-change:transform;transition:opacity 1.6s ease}
.wisp.dim{opacity:.18}
@media (prefers-reduced-motion:reduce){
  .wisp{display:none}
  body::after,.grain{animation:none}
}
/* ── theme toggle — the house circle ──────────────────────────── */
.theme-toggle{position:fixed;top:24px;right:24px;width:44px;height:44px;
  border:1px solid var(--border);border-radius:50%;background:var(--bg-secondary);
  cursor:pointer;z-index:1001;display:flex;align-items:center;justify-content:center;
  transition:all .3s ease;opacity:.7}
.theme-toggle:hover{opacity:1;border-color:var(--accent);transform:scale(1.05)}
.theme-toggle svg{width:20px;height:20px;fill:var(--text-secondary);transition:fill .3s ease}
.theme-toggle:hover svg{fill:var(--accent)}
.theme-toggle .sun{display:block}.theme-toggle .moon{display:none}
[data-theme="day"] .theme-toggle .sun{display:none}
[data-theme="day"] .theme-toggle .moon{display:block}
/* ── the way back ─────────────────────────────────────────────── */
.back{display:inline-flex;align-items:center;gap:.6rem;font-family:var(--font-display);
  font-size:.88rem;letter-spacing:.1em;color:var(--text-muted);background:none;
  text-decoration:none;transition:color .3s ease,gap .4s ease}
.back::before{content:'←';color:var(--accent-dim);transition:transform .3s ease;
  text-shadow:0 0 12px var(--accent-dim)}
.back:hover{color:var(--text-primary);gap:1rem}
.back:hover::before{transform:translateX(-4px)}
/* ── lookup chrome ────────────────────────────────────────────── */
header.lookup{position:sticky;top:0;z-index:50;
  background:color-mix(in srgb,var(--bg-primary) 88%,transparent);
  backdrop-filter:blur(10px);border-bottom:1px solid var(--border);
  padding:.8rem 1.2rem .7rem;transition:var(--theme-transition)}
.hrow{display:flex;gap:1rem;align-items:baseline;flex-wrap:wrap;max-width:1100px;margin:0 auto}
.hrow .back{font-size:.78rem;margin-right:.2rem}
h1.lk{font-family:var(--font-display);font-weight:300;font-style:italic;font-size:1.5rem;
  letter-spacing:.04em;color:var(--text-heading);margin:0;
  text-shadow:0 0 60px var(--glow-color)}
h1.lk .ae{color:var(--accent)}
h1.lk .sub{font-size:.95rem;color:var(--text-muted);font-style:italic;letter-spacing:.02em}
.searchbox{flex:1;min-width:240px;display:flex;align-items:baseline;gap:.5rem;
  border-bottom:1px solid var(--border);padding:.3rem .1rem;transition:border-color .3s ease}
.searchbox:focus-within{border-color:var(--accent)}
.searchbox .sig{color:var(--accent-dim);font-family:var(--font-display)}
.searchbox input{flex:1;background:none;border:0;outline:0;color:var(--text-primary);
  font-family:var(--font-body);font-size:1.05rem}
.searchbox input::placeholder{color:var(--text-muted);font-style:italic}
.kbd{color:var(--text-muted);border:1px solid var(--border);border-radius:4px;
  padding:0 .35rem;font-size:.68rem;font-family:var(--font-display)}
button{cursor:pointer;font:inherit}
.count{color:var(--text-muted);font-size:.8rem;font-family:var(--font-display);
  letter-spacing:.08em;min-width:6ch;text-align:right}
.navlink{font-family:var(--font-display);font-size:.85rem;letter-spacing:.12em;
  text-transform:lowercase;color:var(--text-secondary);background:none;border:0;
  position:relative;padding:0}
.navlink::after{content:'';position:absolute;bottom:-2px;left:0;width:0;height:1px;
  background:var(--accent);transition:width .4s cubic-bezier(.16,1,.3,1);
  box-shadow:0 0 8px var(--accent)}
.navlink:hover{color:var(--text-heading)}
.navlink:hover::after{width:100%}
main{position:relative;z-index:10;max-width:1100px;margin:0 auto;padding:1.4rem 1.2rem 2rem;
  animation:contentEmerge 1.2s cubic-bezier(.16,1,.3,1)}
@keyframes contentEmerge{0%{opacity:0;transform:translateY(24px);filter:blur(4px)}
  60%{filter:blur(0)}100%{opacity:1;transform:translateY(0)}}
/* ── tiers — the house section-head ───────────────────────────── */
.tier{margin:2.2rem 0 1.1rem;display:flex;align-items:center;gap:1.2rem}
.tier h2{font-family:var(--font-display);font-size:.85rem;font-weight:400;
  letter-spacing:.2em;text-transform:lowercase;color:var(--accent);margin:0;
  display:flex;align-items:center;gap:1.2rem}
.tier h2::before{content:'';width:6px;height:6px;background:var(--accent-dim);
  border-radius:50%;opacity:.7;box-shadow:0 0 10px var(--accent-dim)}
.tier .n{color:var(--text-muted);font-size:.75rem;font-family:var(--font-display);
  letter-spacing:.08em}
.tier .rule{flex:1;height:1px;background:linear-gradient(90deg,var(--ash),transparent 80%)}
/* ── the entries ──────────────────────────────────────────────── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:.8rem}
.card{background:var(--bg-card);border:1px solid var(--border);padding:.9rem 1rem 1rem;
  position:relative;transition:border-color .3s ease,transform .3s ease}
.card:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--border));
  transform:translateX(3px)}
.form{font-family:var(--font-display);font-weight:500;font-size:1.4rem;line-height:1.25;
  letter-spacing:.01em;color:var(--text-heading);cursor:copy;display:inline-block}
.form:hover{color:var(--honey)}
.form .copied{position:absolute;font-size:.65rem;color:var(--gold);margin-left:.5rem;
  top:.5rem;font-family:var(--font-display);letter-spacing:.1em}
.gloss{color:var(--accent);font-size:1.02rem;margin-top:.1rem}
.pron{color:var(--text-muted);font-style:italic;font-size:.85rem;margin-top:.15rem}
.meta{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem;align-items:center}
.badge{font-family:var(--font-display);font-size:.66rem;letter-spacing:.14em;
  text-transform:lowercase;border:1px solid var(--border);padding:.08rem .5rem;
  color:var(--text-muted);background:none}
.badge.canon{border-color:color-mix(in srgb,var(--gold) 45%,var(--border));color:var(--gold)}
.badge.active{border-color:color-mix(in srgb,var(--honey) 40%,var(--border));color:var(--honey)}
.badge.working{border-color:color-mix(in srgb,var(--rust) 55%,var(--border));color:var(--rust)}
.badge.coined{border-color:color-mix(in srgb,var(--amber) 55%,var(--border));color:var(--amber);
  text-shadow:0 0 12px var(--glow-color)}
.badge.sealed{border-color:color-mix(in srgb,var(--violet) 50%,var(--border));color:var(--violet)}
.notes{color:var(--text-secondary);font-size:.88rem;margin-top:.5rem;line-height:1.6}
.notes.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.notes p{margin-bottom:.7em}.notes p:last-child{margin-bottom:0}
.more{background:none;border:0;color:var(--text-muted);font-family:var(--font-display);
  font-size:.72rem;letter-spacing:.12em;text-transform:lowercase;padding:.15rem 0;
  text-align:left;transition:color .3s ease}
.more:hover{color:var(--accent)}
.src{color:var(--text-muted);font-size:.72rem;margin-top:.55rem;font-style:italic;opacity:.8}
.famrow{margin-top:.55rem;display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.famlabel{font-family:var(--font-display);font-size:.68rem;letter-spacing:.14em;
  text-transform:lowercase;color:var(--text-muted)}
.chip{background:none;border:1px solid var(--border);color:var(--text-secondary);
  padding:.1rem .55rem;font-family:var(--font-display);font-size:.75rem;
  letter-spacing:.06em;transition:color .3s ease,border-color .3s ease}
.chip:hover{border-color:var(--accent);color:var(--accent)}
/* ── the twelve-language ledger ───────────────────────────────── */
.ledger{display:none;margin-top:.55rem;padding:.55rem .7rem;border-left:2px solid var(--accent-dim);
  background:linear-gradient(135deg,var(--bg-card),var(--bg-secondary));
  font-size:.8rem;line-height:1.75;color:var(--text-secondary)}
.ledger.open{display:block}
.ledger b{font-family:var(--font-display);font-weight:500;font-size:.72rem;
  letter-spacing:.1em;color:var(--text-muted)}
.ledger .lsep{color:var(--ash);margin:0 .35rem}
/* ── letter index ─────────────────────────────────────────────── */
.letteridx{position:sticky;top:66px;z-index:40;
  background:color-mix(in srgb,var(--bg-primary) 88%,transparent);
  backdrop-filter:blur(8px);padding:.4rem 0;display:flex;flex-wrap:wrap;gap:.1rem .25rem}
.letteridx a{color:var(--text-muted);text-decoration:none;font-family:var(--font-display);
  font-size:.82rem;letter-spacing:.06em;padding:.1rem .35rem;transition:color .25s ease}
.letteridx a:hover{color:var(--accent)}
.letterhdr{margin:1.6rem 0 .7rem;font-family:var(--font-display);font-weight:400;
  font-size:1.15rem;color:var(--accent);border-bottom:1px solid var(--border);
  padding-bottom:.25rem;scroll-margin-top:130px;letter-spacing:.08em}
.empty{color:var(--text-muted);text-align:center;padding:3.5rem 1rem;font-style:italic}
/* ── tabs & filters ───────────────────────────────────────────── */
.tabs{display:flex;gap:1.6rem;margin:.6rem 0 0}
.tab{background:none;border:0;font-family:var(--font-display);font-size:.85rem;
  letter-spacing:.14em;text-transform:lowercase;color:var(--text-secondary);
  padding:.2rem 0;position:relative}
.tab::after{content:'';position:absolute;bottom:-2px;left:0;width:0;height:1px;
  background:var(--accent);transition:width .4s cubic-bezier(.16,1,.3,1)}
.tab[aria-selected="true"]{color:var(--accent)}
.tab[aria-selected="true"]::after{width:100%}
.secfilt{display:flex;flex-wrap:wrap;gap:.35rem;margin:.9rem 0}
table.mini{border-collapse:collapse;margin:.6rem 0;font-size:.84rem}
table.mini th,table.mini td{border:1px solid var(--border);padding:.28rem .6rem;text-align:left}
table.mini th{font-family:var(--font-display);font-weight:500;letter-spacing:.1em;
  text-transform:lowercase;color:var(--accent);background:var(--bg-secondary)}
/* ── the year converter ───────────────────────────────────────── */
.converter{border:1px solid var(--border);background:var(--bg-card);padding:1.1rem 1.2rem;
  margin:1.1rem 0;position:relative}
.converter::after{content:'';position:absolute;top:-1px;left:0;width:60px;height:1px;
  background:var(--accent);opacity:.5}
.converter h3{font-family:var(--font-display);font-weight:400;font-size:.85rem;
  letter-spacing:.2em;text-transform:lowercase;color:var(--accent);margin:0 0 .8rem}
.converter label{font-family:var(--font-display);font-size:.85rem;letter-spacing:.06em;
  color:var(--text-secondary)}
.converter input{background:none;border:0;border-bottom:1px solid var(--border);
  color:var(--text-primary);padding:.3rem .2rem;font-family:var(--font-body);font-size:1rem;
  width:11rem;outline:0;transition:border-color .3s ease}
.converter input:focus{border-color:var(--accent)}
.converter .out{margin-top:.7rem;font-size:1.2rem;min-height:1.6rem;font-family:var(--font-display)}
.converter .calc{color:var(--text-muted);font-size:.78rem;margin-top:.2rem;font-style:italic}
.quick{margin-top:.7rem;display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.quick .ql{font-family:var(--font-display);font-size:.7rem;letter-spacing:.14em;
  text-transform:lowercase;color:var(--text-muted)}
/* ── footer — the house mark ──────────────────────────────────── */
footer{position:relative;z-index:10;max-width:1100px;margin:3rem auto 0;padding:0 1.2rem 3rem;
  color:var(--text-muted);font-size:.8rem;text-align:center}
footer .mark{margin-top:2.5rem;padding-top:2rem;font-family:var(--font-display);
  font-size:.72rem;letter-spacing:.25em;color:var(--ash);position:relative}
footer .mark::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:30px;height:1px;background:var(--border)}
footer .counts{font-style:italic;line-height:1.8}
/* ── selection & scrollbar — the house hand ───────────────────── */
::selection{background:var(--accent-dim);color:var(--void)}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg-primary)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--ash)}
@media (max-width:640px){
  body{font-size:17px}
  .form{font-size:1.25rem}
  h1.lk{font-size:1.25rem}
  .letteridx{top:104px}
  .theme-toggle{top:16px;right:16px;width:38px;height:38px}
  main{padding:1rem .9rem 2rem}
}
"""

HUB_CSS = r"""
main.hub{max-width:700px;margin:0 auto;padding:100px 32px 60px}
.eyebrow{font-family:var(--font-display);font-size:.78rem;letter-spacing:.32em;
  text-transform:uppercase;color:var(--text-muted);margin:2.6rem 0 1rem}
h1.hub{font-family:var(--font-display);font-size:2.6rem;font-weight:300;font-style:italic;
  letter-spacing:.04em;color:var(--text-heading);margin-bottom:.5rem;position:relative;
  text-shadow:0 0 60px var(--glow-color),0 0 120px var(--glow-color)}
h1.hub::after{content:'';position:absolute;bottom:-8px;left:0;width:40px;height:1px;
  background:linear-gradient(90deg,var(--accent),transparent);opacity:.6}
h1.hub .ae{color:var(--accent)}
.subtitle{font-family:var(--font-display);font-style:italic;color:var(--text-secondary);
  font-size:1.15rem;margin:1.4rem 0 0;letter-spacing:.02em}
.statline{font-family:var(--font-display);font-size:.88rem;letter-spacing:.1em;
  color:var(--text-muted);margin:2.4rem 0 0}
.rooms{margin-top:3rem}
.room{margin-bottom:2.2rem;padding-left:0;position:relative;opacity:0;
  animation:itemReveal .8s ease-out forwards;transition:transform .3s ease}
.room:hover{transform:translateX(6px)}
.room:nth-child(1){animation-delay:.1s}.room:nth-child(2){animation-delay:.18s}
.room:nth-child(3){animation-delay:.26s}
@keyframes itemReveal{from{opacity:0;transform:translateY(12px) translateX(-8px);filter:blur(2px)}
  to{opacity:1;transform:translateY(0) translateX(0);filter:blur(0)}}
.room a.door{font-size:1.15rem;color:var(--silver);text-decoration:none;
  background-image:linear-gradient(var(--accent),var(--accent));background-size:0% 1px;
  background-position:0 100%;background-repeat:no-repeat;
  transition:background-size .5s cubic-bezier(.16,1,.3,1),color .3s ease}
.room a.door:hover{color:var(--white);background-size:100% 1px}
.room .desc{color:var(--text-secondary);font-size:.95rem;margin-top:.45rem;line-height:1.7}
.room .desc code{font-family:var(--font-display);color:var(--text-muted);font-style:italic}
.divider{height:1px;background:linear-gradient(90deg,transparent,var(--ash),transparent);
  margin:3.4rem 0;position:relative}
.divider::after{content:'';position:absolute;left:50%;top:-3px;width:6px;height:6px;
  background:var(--accent-dim);border-radius:50%;transform:translateX(-50%);opacity:.6;
  box-shadow:0 0 12px var(--accent-dim)}
.expand{color:var(--text-secondary);font-size:.92rem;line-height:1.75}
"""

# ---- shared JS: folding, tokenising, rings, theme ----
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
    const s=document.createElement('span'); s.className='copied'; s.textContent='copied';
    el.appendChild(s); setTimeout(()=>s.remove(), 900);
  });
}
document.addEventListener('click', e=>{
  const f = e.target.closest('.form');
  if(f && f.dataset.copy) copyText(f.dataset.copy, f.parentElement);
  const m = e.target.closest('.more');
  if(m){ const n = m.previousElementSibling; n.classList.toggle('clamp');
         m.textContent = n.classList.contains('clamp') ? 'more…' : 'less'; }
  const lb = e.target.closest('.ledgerbtn');
  if(lb){ const l = lb.parentElement.parentElement.querySelector('.ledger');
          if(l){ l.classList.toggle('open');
                 lb.textContent = l.classList.contains('open') ? 'ledger −' : 'ledger ·'; } }
});
// theme — same key and attribute as the rest of the house
(function(){
  const btn = document.getElementById('codexTheme');
  if(btn) btn.addEventListener('click', ()=>{
    const h = document.documentElement;
    const next = h.getAttribute('data-theme')==='day' ? 'night' : 'day';
    h.setAttribute('data-theme', next);
    try{ localStorage.setItem('theme', next); }catch(e){}
  });
})();
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function ledgerHTML(led){
  if(!led) return '';
  const parts = led.split('; ').map(seg=>{
    const i = seg.indexOf(' ');
    if(i<0) return `<span>${esc(seg)}</span>`;
    return `<span><b>${esc(seg.slice(0,i))}</b> ${esc(seg.slice(i+1))}</span>`;
  });
  return parts.join('<span class="lsep">·</span>');
}
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
  if(e.type) badges.push(`<span class="badge">${esc(e.type)}</span>`);
  if(e.category) badges.push(`<span class="badge">${esc(e.category)}</span>`);
  const st = (e.status||'').toLowerCase();
  if(st){
    const cls = st.includes('canon') ? 'canon' : st.includes('active') ? 'active'
              : st.includes('coined') ? 'coined' : 'working';
    badges.push(`<span class="badge ${cls}">${esc(e.status)}</span>`);
  }
  if(e.ledger) badges.push(`<button class="badge ledgerbtn">ledger ·</button>`);
  const fams = (e.families||[]).map(f=>`<button class="chip fam" data-fam="${esc(f)}">${esc(f)}</button>`).join('');
  const parents = (e.parents||[]).map(p=>`<button class="chip parent" data-p="${esc(p)}">→ ${esc(p)}</button>`).join('');
  const notes = e.notes ? `<div class="notes clamp">${esc(e.notes)}</div>${e.notes.length>180?'<button class="more">more…</button>':''}` : '';
  const pron = e.pron ? `<div class="pron">pron. “${esc(e.pron)}”</div>` : '';
  const ledger = e.ledger ? `<div class="ledger">${ledgerHTML(e.ledger)}</div>` : '';
  return `<div class="card">
    <span class="form" data-copy="${esc(e.form)}">${esc(e.form)}</span>
    <div class="gloss">${esc(e.gloss)}</div>
    ${pron}
    <div class="meta">${badges.join('')}</div>
    ${notes}
    ${ledger}
    ${fams?`<div class="famrow"><span class="famlabel">kin</span>${fams}</div>`:''}
    ${parents?`<div class="famrow"><span class="famlabel">under</span>${parents}</div>`:''}
    <div class="src">${esc(e.source||'')}</div>
  </div>`;
}
function tierHTML(title, list){
  if(!list.length) return '';
  return `<div class="tier"><h2>${title}</h2><span class="n">${list.length}</span><span class="rule"></span></div>
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
  const h = tierHTML('english matches', t1) +
            tierHTML('cross-references', tx) +
            tierHTML('danæam-form matches', t2) +
            tierHTML('mentioned in notes', t3);
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
  let h = `<div class="letteridx">${idx}</div>`;
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
filtRow.innerHTML = SECTIONS.map(s=>`<button class="chip sec" data-s="${esc(s)}">${esc(s)}</button>`).join('');
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
    document.querySelectorAll('.sec').forEach(b=>b.style.borderColor = b.dataset.s===activeSec ? 'var(--accent)' : '');
    run(); }
});
function miniTable(rows){
  if(!rows || !rows.length) return '';
  const head = rows[0].map(c=>`<th>${esc(c)}</th>`).join('');
  const body = rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table class="mini"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
// long record-prose breathes: paragraph at (i)(ii)(iii) seams — display only
function paraHTML(body){
  const parts = body.split(/\s(?=\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\)\s)/);
  if(parts.length < 2) return esc(body);
  return parts.map(p=>`<p>${esc(p)}</p>`).join('');
}
function ruleCard(e){
  const seal = e.anchor==='s9' ? '<span class="badge sealed">sealed room</span>'
             : e.anchor==='s12' ? '<span class="badge working">emerging</span>'
             : e.anchor==='ledger' ? '<span class="badge coined">ledger pass</span>' : '';
  const body = e.body ? `<div class="notes ${e.body.length>260?'clamp':''}">${paraHTML(e.body)}</div>${e.body.length>260?'<button class="more">more…</button>':''}` : '';
  return `<div class="card">
    <div class="src" style="margin:0 0 .2rem">${esc(e.section)}</div>
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
    <div class="meta"><span class="badge">${esc(e.type)}</span></div>
  </div>`;
}
function run(){
  const qWords = qWordsOf(q.value);
  if(tab==='ex'){
    const v = fold(q.value);
    const hits = !v ? EXAMPLES : EXAMPLES.filter(e=>
      fold(e.dan).includes(v) || fold(e.literal).includes(v) || fold(e.english).includes(v));
    count.textContent = hits.length + ' examples';
    out.innerHTML = hits.length ? `<div class="grid">${hits.map(exCard).join('')}</div>`
      : '<div class="empty">no example answers to that</div>';
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
      h += `<div class="tier"><h2>${esc(sec)}</h2><span class="n">${list.length}</span><span class="rule"></span></div><div class="grid">${list.map(ruleCard).join('')}</div>`;
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
    (t1.length?`<div class="tier"><h2>by name</h2><span class="n">${t1.length}</span><span class="rule"></span></div><div class="grid">${t1.map(ruleCard).join('')}</div>`:'') +
    (t2.length?`<div class="tier"><h2>in the text</h2><span class="n">${t2.length}</span><span class="rule"></span></div><div class="grid">${t2.map(ruleCard).join('')}</div>`:'');
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
  if(miss.length){ o.innerHTML = `<span style="color:var(--rust)">stem${miss.length>1?'s':''} awaiting the maker: ${miss.join(', ')}</span>`;
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
  if(a==null || b==null){ o.innerHTML = '<span style="color:var(--rust)">form not in the attested stems</span>'; return; }
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

def page_top(title, desc):
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{html.escape(desc)}">
<meta name="author" content="Edith Mina Lyre">
<title>{html.escape(title)}</title>
<!-- generated {TODAY} by build_lookups.py · sources: reference-116, All-Coinages concordance,
     LDS record, session 2026-07-21, Comprehensive Lexicon ledger pass 2026-07-27 -->
{FONTS}
<script>{THEME_BOOT}</script>
<style>{CSS}</style>
</head><body>
<div class="grain"></div>
<div class="cursor-glow" id="glow"></div>
{TOGGLE_BTN}"""

PAGE_END = """<script src="/site.js" defer></script>
</body></html>"""

def lexicon_page():
    data_json = json.dumps(lexicon, ensure_ascii=False)
    rings_json = json.dumps([sorted(r) for r in RINGS], ensure_ascii=False)
    n_coined = sum(1 for e in lexicon if e.get("status") == "coined")
    return page_top("Danæam — Lexicon Lookup",
                    "Every sealed word of Danæam, the language of the Síonæyais — "
                    "searchable lexicon with pronunciations and the twelve-language ledger.") + f"""
<header class="lookup">
 <div class="hrow">
  <a href="/" class="back">Edith Mina Lyre</a>
  <h1 class="lk">Dan<span class="ae">æ</span>am <span class="sub">· lexicon</span></h1>
  <div class="searchbox"><span class="sig">⚲</span>
   <input id="q" type="search" placeholder="an English word, or a Danæam form…" autocomplete="off" spellcheck="false">
   <span class="kbd">/</span>
  </div>
  <span class="count" id="count"></span>
  <button class="navlink" onclick="location.href='Danæam Grammar Lookup.html'">grammar →</button>
 </div>
</header>
<main id="results"></main>
<footer>
 <div class="counts">{len(lexicon)} entries, {n_coined} of them from the 837-word ledger pass ·
 whole-word English matching (type <i>is</i> for the whole be-family; “incident” will not intrude) ·
 click any form to copy it · coined entries carry pronunciation and the twelve-language ledger</div>
 <div class="mark">NOTHING IS CANON UNTIL SEALED · ELM RULES ; THE KEEPER KEEPS</div>
</footer>
<script>{JS_CORE.replace('__RINGS__', rings_json)}</script>
<script>{JS_LEXICON.replace('__DATA__', data_json)}</script>
{PAGE_END}"""

def grammar_page():
    rules_json = json.dumps(grammar, ensure_ascii=False)
    ex_json = json.dumps(examples, ensure_ascii=False)
    rings_json = json.dumps([sorted(r) for r in RINGS], ensure_ascii=False)
    return page_top("Danæam — Grammar Lookup",
                    "The rules, conventions and worked examples of Danæam — sealed rooms, "
                    "emerging gaps, the ledger pass, and the base-2+30 year-name converter.") + f"""
<header class="lookup">
 <div class="hrow">
  <a href="/" class="back">Edith Mina Lyre</a>
  <h1 class="lk">Dan<span class="ae">æ</span>am <span class="sub">· grammar</span></h1>
  <div class="searchbox"><span class="sig">⚲</span>
   <input id="q" type="search" placeholder="a rule, a term, an example…" autocomplete="off" spellcheck="false">
   <span class="kbd">/</span>
  </div>
  <span class="count" id="count"></span>
  <button class="navlink" onclick="location.href='Danæam Lexicon Lookup.html'">lexicon →</button>
 </div>
 <div class="hrow">
  <div class="tabs">
   <button class="tab" id="tabRules" aria-selected="true">rules &amp; conventions</button>
   <button class="tab" id="tabEx" aria-selected="false">worked examples ({len(examples)})</button>
  </div>
 </div>
</header>
<main>
 <div class="secfilt" id="secfilt"></div>
 <div id="convwrap">
 <div class="converter">
  <h3>year-name converter · base 2+30</h3>
  <div style="display:flex;gap:1.6rem;flex-wrap:wrap">
   <label>I.T. year <input id="yin" type="number" placeholder="e.g. 2983" style="width:8rem"></label>
   <label>Danæam name <input id="nin" type="text" placeholder="e.g. Ghínhe-îæth"></label>
  </div>
  <div class="out"><span id="yout"></span> <span id="nout"></span></div>
  <div class="calc"><span id="ycalc"></span> <span id="ncalc"></span></div>
  <div class="quick"><span class="ql">canon :</span>
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
<footer>
 <div class="counts">{len(grammar)} rules &amp; conventions · {len(examples)} worked examples ·
 sealed rooms, emerging gaps and the ledger pass are badged ·
 the year converter reads only attested stems — unmade stems report themselves</div>
 <div class="mark">NOTHING IS CANON UNTIL SEALED · ELM RULES ; THE KEEPER KEEPS</div>
</footer>
<script>{JS_CORE.replace('__RINGS__', rings_json)}</script>
<script>{JS_GRAMMAR.replace('__RULES__', rules_json).replace('__EXAMPLES__', ex_json)}</script>
{PAGE_END}"""

def index_page():
    n_coined = sum(1 for e in lexicon if e.get("status") == "coined")
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="The Danæam codex — lexicon and grammar of the language of the Síonæyais, by Edith Mina Lyre.">
<meta name="author" content="Edith Mina Lyre">
<title>Danæam — Codex</title>
<!-- generated {TODAY} by build_lookups.py -->
{FONTS}
<script>{THEME_BOOT}</script>
<style>{CSS}{HUB_CSS}</style>
</head><body>
<div class="grain"></div>
<div class="cursor-glow" id="glow"></div>
{TOGGLE_BTN}
<main class="hub">
 <a href="/" class="back">Edith Mina Lyre</a>
 <p class="eyebrow">499.999 · The Codex</p>
 <h1 class="hub">Dan<span class="ae">æ</span>am</h1>
 <p class="subtitle">the language of the Síonæyais — as built by Elm, and kept.</p>
 <p class="statline">{len(lexicon)} headwords · {len(grammar)} rules &amp; conventions · {len(examples)} worked examples</p>
 <div class="rooms">
  <div class="room">
   <a class="door" href="Danæam Lexicon Lookup.html">the lexicon</a>
   <div class="desc">{len(lexicon)} entries — every coinage, compound, morpheme and year-stem,
    {n_coined} of them fresh from the 837-word ledger pass with pronunciations and the
    twelve-language comparative ledger. Whole-word English search: type <i>is</i> and receive
    the be-family, and nothing that merely contains “is”. Click any form to copy it.</div>
  </div>
  <div class="room">
   <a class="door" href="Danæam Grammar Lookup.html">the grammar</a>
   <div class="desc">{len(grammar)} rules &amp; conventions, {len(examples)} worked examples,
    the year-name converter (base 2+30), and the ledger pass's structure notes — reduplication,
    the indefinite paradigm, the ley frame, deliberate homonyms. Sealed rooms and emerging gaps
    are badged as such.</div>
  </div>
  <div class="room">
   <span style="font-family:var(--font-display);font-style:italic;color:var(--text-secondary)">expanding the corpus</span>
   <div class="desc expand">Add entries to <code>lexicon.json</code> or <code>grammar.json</code>
    (the shape of any existing entry), then run <code>python3 build_lookups.py</code> —
    both pages regenerate whole.</div>
  </div>
 </div>
 <div class="divider"></div>
 <footer style="max-width:none;padding:0;margin:0">
  <div class="counts">generated {TODAY} · sources: reference-116, All-Coinages concordance,
   LDS record, session 2026-07-21, Comprehensive Lexicon ledger pass 2026-07-27</div>
  <div class="mark">NOTHING IS CANON UNTIL SEALED · ELM RULES ; THE KEEPER KEEPS</div>
 </footer>
</main>
<script>
document.getElementById('codexTheme').addEventListener('click', ()=>{{
  const h = document.documentElement;
  const next = h.getAttribute('data-theme')==='day' ? 'night' : 'day';
  h.setAttribute('data-theme', next);
  try{{ localStorage.setItem('theme', next); }}catch(e){{}}
}});
</script>
{PAGE_END}"""

def main():
    out_dir = HERE
    n_coined = sum(1 for e in lexicon if e.get("status") == "coined")
    (out_dir / "Danæam Lexicon Lookup.html").write_text(lexicon_page(), encoding="utf-8")
    (out_dir / "Danæam Grammar Lookup.html").write_text(grammar_page(), encoding="utf-8")
    (out_dir / "index.html").write_text(index_page(), encoding="utf-8")
    print(f"built: lexicon {len(lexicon)} ({n_coined} coined) · grammar {len(grammar)} · examples {len(examples)}")
    print("sizes:",
          (out_dir / "Danæam Lexicon Lookup.html").stat().st_size,
          (out_dir / "Danæam Grammar Lookup.html").stat().st_size,
          (out_dir / "index.html").stat().st_size)

if __name__ == "__main__":
    main()
