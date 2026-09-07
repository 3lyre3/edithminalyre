"""Assemble the milestone presentation site into ../ (the milestone/ folder of the repo).

Usage:  python build-milestone.py [SRC]
SRC is the folder holding the pages as delivered (default: the Desktop 'Everything-a-False-Cow-needs').
Every page is copied in, re-pointed at the site's shared style.css / site.js one level up, given its
back arrow and onward link per the page tree, and the Notes page is built from its .docx with a
fast hoverable reel of manuscript links under each note.

The route, with the script's ordinals:
    [1.0] Map I  -THIS->  [1.1] Map II  -IS / NOT THE->  [1.2] Map III  -WORLD...->  Plate IV
    Plate IV:  Faerieland zone -> [2.0] faerieland (back to Plate IV) ;  Intermaze zone -> [1.3] paxie
    [1.3] paxie:  #1 "Paxie starts here!" -> come-with-me ("Me or E?") ;  #23 -> dear-ama
    come-with-me:  Go with E [2.1] -> [3.0] dear-ama ;  Come with me -> [5.0] and-reconciliation
    out of order (the defiant reader):  [3.0] dear-ama -> [3.1] mestarmya -> ([3.2] Daedalus, not yet written)
        -> [4.0] the-paxiean-histories (Pasiphaë's opening notes)
    in order:  [4.0] -> [4.1] left-hand-realism -> [4.2] coda -> [4.3] c1da -> [4.4] the-false-cow
        -> ([3.2]) -> [3.1] mestarmya -> [3.0] dear-ama -> [5.0] and-reconciliation -> [5.1] notes-on
"""
import html, math, os, re, shutil, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import faedocx
from faedocx import Doc, render_runs, para_html

SRC = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\3lyre\Desktop\Everything-a-False-Cow-needs'
OUT = os.path.normpath(os.path.join(HERE, '..'))
DOCX = os.path.join(SRC, 'Letters-of-Reconciliation_Notes-page_Text.docx')

def read(name, folder=SRC):
    with open(os.path.join(folder, name), encoding='utf-8') as f:
        return f.read()

def write(name, text):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print(f'  wrote {name:32} {len(text):>8,} chars')

def sub1(text, pattern, repl, flags=0, count=1, what=''):
    """re.sub that insists on finding its target: a silent miss would ship a broken page."""
    new, n = re.subn(pattern, repl, text, count=count, flags=flags)
    assert n >= 1, f'pattern not found: {what or pattern!r}'
    return new

def replace1(text, old, new, what=''):
    assert old in text, f'text not found: {what or old!r}'
    return text.replace(old, new, 1)

# ───────────────────────────────────────────────── shared snippets
MILESTONE_JS = '''/* milestone.js — the back arrow retraces your own steps when you arrived from
   within the milestone (pages with more than one parent need this); otherwise
   it falls back to the page's default parent, the href. */
(() => {
  document.addEventListener('click', (event) => {
    const back = event.target.closest('a.back');
    if (!back || back.dataset.hard !== undefined) return;
    let from = '';
    try { from = new URL(document.referrer).pathname; } catch { return; }
    if (history.length > 1 && from.includes('/milestone/')) {
      event.preventDefault();
      history.back();
    }
  });
})();
'''

CHROME_HIDE_CSS = '''
  /* the shared site chrome (mounted by ../site.js) has no place on the plates */
  .theme-toggle, .cursor-glow, .wisp, .grain { display: none !important; }
'''

PLATE_BACK_CSS = '''
  /* ── back, top right: bone at rest, the plates' red when touched ── */
  .back {
    position: fixed;
    top: 18px;
    right: 22px;
    z-index: 10;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.7rem;
    line-height: 1;
    padding: 10px 12px;
    color: rgba(227, 218, 201, 0.7);
    text-decoration: none;
    outline: none;
    transition: color 480ms ease-out, text-shadow 480ms ease-out;
  }
  .back:hover, .back:focus-visible {
    color: rgb(166, 34, 39);
    text-shadow: 0 0 0.16em rgba(214, 66, 58, .75), 0 0 0.5em rgba(214, 66, 58, .4);
  }
'''

def plate_scripts():
    return '  <script src="../site.js"></script>\n  <script src="milestone.js"></script>\n</body>'

def back_anchor(href, label='Back'):
    return f'<a class="back" href="{href}" aria-label="{label}">&larr;</a>'

# ───────────────────────────────────────────────── the three maps
def build_map(name, live_href, back_href):
    t = read(name)
    # the live word may hold the ellipsis span ("WORLD..."), so allow one nested span inside
    t, n = re.subn(r'<span class="word word--live" tabindex="0">((?:[^<]|<span class="dots">[^<]*</span>)*)</span>',
                   rf'<a class="word word--live" href="{live_href}">\1</a>', t)
    assert n >= 1, f'{name}: no live words found'
    t = replace1(t, '  .word--live {\n    pointer-events: auto;\n    cursor: default;',
                 '  a.word { color: var(--bone); text-decoration: none; }\n\n  .word--live {\n    pointer-events: auto;\n    cursor: pointer;',
                 f'{name}: live-word css')
    t = replace1(t, '</style>', PLATE_BACK_CSS + CHROME_HIDE_CSS + '</style>', f'{name}: style end')
    t = replace1(t, '<body>\n', '<body>\n  ' + back_anchor(back_href) + '\n\n', f'{name}: body start')
    t = replace1(t, '</body>', plate_scripts(), f'{name}: body end')
    write(name, t)

# ───────────────────────────────────────────────── Plate IV
def build_plate_iv():
    t = read('plate-iv-zones (5).html')
    t = replace1(t, '<title>Plate IV</title>', '<title>Plate IV – This is not the world</title>')
    t = replace1(t, '  .zone.hold, .zone.hold:hover { transform: none; }',
                 '  .zone.linked { cursor: pointer; }\n  .zone.hold, .zone.hold:hover { transform: none; }',
                 'plate-iv: linked css')
    t = replace1(t, '</style>', PLATE_BACK_CSS + CHROME_HIDE_CSS + '</style>', 'plate-iv: style end')
    t = replace1(t, '<body>\n', '<body>\n  ' + back_anchor('this-is-not-the-world-iii.html') + '\n\n', 'plate-iv: body start')
    links_js = '''
  // where a zone leads: click or Enter opens it. Zones without a destination stay as they were.
  const LINKS = {"faerieland": "faerieland.html", "walkways": "paxie.html"};
  for (const [id, href] of Object.entries(LINKS)) {
    const el = document.getElementById(id);
    el.classList.add('linked');
    const go = () => { location.href = href; };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }

  svg.addEventListener('pointermove', e => {'''
    t = replace1(t, "\n  svg.addEventListener('pointermove', e => {", links_js, 'plate-iv: pointermove hook')
    t = replace1(t, '</body>', plate_scripts(), 'plate-iv: body end')
    write('plate-iv.html', t)

# ───────────────────────────────────────────────── Paxie's map
def build_paxie():
    t = read('paxie.html')
    t = replace1(t, '<a class="pt" id="stop-1" href="#">', '<a class="pt" id="stop-1" href="come-with-me.html">')
    t = replace1(t, '<a class="pt" id="stop-23" href="#">', '<a class="pt" id="stop-23" href="dear-ama.html">')
    t = replace1(t, '<a class="back" href="faerieland.html" aria-label="Back to Faerieland">&larr;</a>',
                 back_anchor('plate-iv.html'))
    t = replace1(t, '</style>', CHROME_HIDE_CSS + '</style>', 'paxie: style end')
    t = replace1(t, '</body>', plate_scripts(), 'paxie: body end')
    write('paxie.html', t)

# ───────────────────────────────────────────────── Me or E?
def build_come_with_me():
    t = read('come-with-me.html')
    t = replace1(t, '<a class="word word--come" href="#"', '<a class="word word--come" href="and-reconciliation.html"')
    t = replace1(t, '<a class="word word--go" href="#"', '<a class="word word--go" href="dear-ama.html"')
    t = replace1(t, '<a class="back" href="faerieland.html" aria-label="Back to Faerieland">&larr;</a>',
                 back_anchor('paxie.html'))
    t = replace1(t, '</style>', CHROME_HIDE_CSS + '</style>', 'come-with-me: style end')
    t = replace1(t, '</body>', plate_scripts(), 'come-with-me: body end')
    write('come-with-me.html', t)

# ───────────────────────────────────────────────── Faerieland document pages
def retarget_doc(t, slug):
    t = t.replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="../style.css">')
    t = t.replace('<script src="site.js"></script>', '<script src="../site.js"></script>\n    <script src="milestone.js"></script>')
    t = t.replace(f'https://edithminalyre.com/{slug}.html', f'https://edithminalyre.com/milestone/{slug}.html')
    assert '../style.css' in t and '../site.js' in t, f'{slug}: shared assets not re-pointed'
    return t

def onward(nxt=None, prev=None):
    """The onward nav under the text: `prev` runs back toward the start (the script's reverse chain,
    3.0 -> 3.1 -> 3.2 -> 4.0), `next` runs on in order. Each is (href, label)."""
    links = ''
    if prev: links += f'<a class="prev" href="{prev[0]}">{prev[1]}</a>'
    if nxt:  links += f'<a class="next" href="{nxt[0]}">{nxt[1]}</a>'
    return f'<nav class="onward">{links}</nav>\n\n        <div class="mark"></div>'

def build_doc(slug, back_href, ordinal=None, nxt=None, prev=None, post=None):
    t = retarget_doc(read(slug + '.html'), slug)
    t = sub1(t, r'<a href="[^"]*" class="back back--corner" aria-label="[^"]*"></a>',
             f'<a href="{back_href}" class="back back--corner" aria-label="Back"></a>', what=f'{slug}: back arrow')
    if ordinal:                                   # the script's ordinal, small, above the title
        t = sub1(t, r'(\n\s*)<h1', rf'\1<p class="ordinal">{ordinal}</p>\1<h1', what=f'{slug}: h1 for ordinal')
    if nxt or prev:
        t = replace1(t, '<div class="mark"></div>', onward(nxt, prev), f'{slug}: mark')
    if post:
        t = post(t)
    write(slug + '.html', t)

# ───────────────────────────────────────────────── footnote tags in "and Reconciliation"
# Each of E's notes 4–19 comments on a passage of Bryth's letter; a small numbered tag sits at that
# passage and opens the note, and the note's number leads back up to the tag. Notes 1–3 concern the
# texts before the letter and carry no tag. The phrase must occur exactly once, or the build stops.
FOOTNOTES = [
    ('4',  'what-and-ever'),                                                     # E’s ‘and’ for Amaldéu’s NAND
    ('4a', 'of incarcerated aufGaolaí.'),                                        # histories like these
    ('5',  'to nor either benefit by the closure thereof.'),                     # the oath: prophecy for imperative
    ('6',  'Tear your tongue lengthwise and learn to speak again.'),             # prophecy re-shackled to imperative
    ('7',  'I literally don’t have it to give’ things.'),                        # giving, giving, getting
    ('8',  'And never at my eyes. “What’s obvious, Britt?”'),                    # Britt’s field-report
    ('9',  'I will not give the name “rape” to our first event.'),               # the green translations
    ('10', '“I’m guilty if that’s what turns you on.”'),                         # correct hurting, correct turning on
    ('11', 'Then we kissed. Shuddered. She vomited.'),                           # “Eyen.” — cops’ eyes, fey-green
    ('12', 'which out of love for Red I still don’t.'),                          # the Faerishest sentence
    ('13', 'It’s a thing I’ve found ways to think only in the negative.'),       # Genghis; the negative realm
    ('14', 'jolted the performance to a more-than-overdue conclusion.'),         # Night: very Catholic
    ('15', 'fugueless trudge from the Shimmerlands'),                            # the fugueless return
    ('16', '(‘obviousness’ being the exchange-mechanism bonding reality and the Real)'),  # seed and mechanism
    ('17', 'But everything hurts someone.'),                                     # Paris and Marigail
    ('18', 'Faer Avatar’s eye beckons you, little ray.'),                        # ‘dreamer’ of the ‘eye’
    ('19', 'drawing in when the tongue retracted.'),                             # the ley-eel, glossed
]

def reconciliation_footnotes(t):
    for n, phrase in FOOTNOTES:
        assert t.count(phrase) == 1, f'and-reconciliation: footnote {n} phrase found {t.count(phrase)} times: {phrase!r}'
        note = re.match(r'\d+', n).group()
        tag = f'<a class="fn" id="fn-{n}" href="notes-on.html#note-{note}" aria-label="Note {n}">{n}</a>'
        t = t.replace(phrase, phrase + tag, 1)
    return t

def faerieland_links(t):
    t = replace1(t, '<span class="n">6—</span> and Reconciliation',
                 '<a href="and-reconciliation.html"><span class="n">6—</span> and Reconciliation</a>')
    t = replace1(t, '<span class="n">7—</span> Letter Four-Point-Ten',
                 '<a href="dear-ama.html"><span class="n">7—</span> Letter Four-Point-Ten</a>')
    t = replace1(t, '<span class="n">8—</span> Translating Faerish to English — Notes',
                 '<a href="notes-on.html"><span class="n">8—</span> Translating Faerish to English — Notes</a>')
    return t

# ───────────────────────────────────────────────── page head for the pages built here
HEAD = '''<!DOCTYPE html>
<html lang="en" class="faerieland">
<head>
<link rel="alternate" type="text/plain" href="/agents.txt" title="Agent Instructions">
    <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM Context">

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="__DESC__">
    <meta property="og:title" content="__TITLE__ – Edith Mina Lyre">
    <meta property="og:description" content="__DESC__">
    <meta property="og:type" content="article">
    <meta property="og:image" content="https://edithminalyre.com/images/author.jpg">
    <meta property="og:url" content="https://edithminalyre.com/milestone/__SLUG__.html">
    <link rel="canonical" href="https://edithminalyre.com/milestone/__SLUG__.html">
    <link rel="alternate" hreflang="en-AU" href="https://edithminalyre.com/milestone/__SLUG__.html">
    <link rel="alternate" hreflang="x-default" href="https://edithminalyre.com/milestone/__SLUG__.html">
    <meta name="author" content="Edith Mina Lyre">
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">

    <link rel="shortcut icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="alternate" type="application/rss+xml" title="Edith Mina Lyre RSS Feed" href="/feed.xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;1,300;1,400&amp;family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&amp;display=swap" rel="stylesheet">

    <title>__TITLE__ – Edith Mina Lyre</title>
    <link rel="stylesheet" href="../style.css">
    <link rel="stylesheet" href="faerieland.css">
</head>
<body>
'''
FOOT = '''
    <script src="../site.js"></script>
    <script src="milestone.js"></script>
    <script>document.documentElement.dataset.theme = 'night';</script>
</body>
</html>
'''
def page(slug, title, desc, main):
    return HEAD.replace('__SLUG__', slug).replace('__TITLE__', title).replace('__DESC__', desc) + main + FOOT

# ───────────────────────────────────────────────── Notes, from the .docx
TITLE_STYLES = ('Heading1', '2Title', 'ATitleForMen')
CLASS_FOR_STYLE = {'1CleanQuote': 'quote', '1BlockQuote': 'bq', '1Epigraph': 'epi', 'SpecialOpener': 'opener',
                   'SpecialTitleIndex': 'ix-title', 'SpecialSubtitleIndex': 'ix-sub', 'Specialinitial': 'initial'}

def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower() or 'section'
    return s if s[0].isalpha() else 'sec-' + s          # an id must begin with a letter

def plain(p):
    return ''.join(t for k, t, _ in p['runs'] if k == 't')

def title_html(p):
    runs = [(k, t, {kk: vv for kk, vv in rp.items() if kk != 'r_b'}) for k, t, rp in p['runs']]
    inner = render_runs(runs).strip()
    jc = p['props'].get('jc')
    align = 'centered' if jc == 'center' else ('right' if jc in ('right', 'end') else '')
    return align, f'<h1{" class=" + chr(34) + align + chr(34) if align else ""}>{inner}</h1>'

RE_LABELS = re.compile(r'\|([^|]+)\|')
RE_CHAPTER = re.compile(r'^\s*[^\s—|]+—\s*…')          # 'Aint— …Better Lie…'
RE_NUMBER = re.compile(r'^\s*\d+[a-z]?—\s*$')            # '1—'  '4a— '

def reel_html(labels, note_no):
    reps = max(2, math.ceil(8 / len(labels)))            # enough cards that the band never shows its seam
    cards = ''.join(f'<a class="card" href="manuscript.html#{slugify(l)}">{html.escape(l)}</a>' for l in labels)
    half = f'<div class="reel-half">{cards * reps}</div>'
    copy = f'<div class="reel-half" aria-hidden="true">{(cards * reps).replace("<a ", "<a tabindex=" + chr(34) + "-1" + chr(34) + " ")}</div>'
    n = len(labels) * reps
    return (f'<nav class="reel" style="--n:{n}" aria-label="Manuscript sections for note {note_no}">'
            f'<div class="reel-track">{half}{copy}</div></nav>')

def build_notes():
    d = Doc(DOCX)
    faedocx.TEXT_WIDTH = d.text_width
    paras = list(d.paragraphs())
    align, h1 = '', None
    body, notes = [], []                                  # notes: (number, chapter, labels) for the manuscript stub
    chapter, number, open_section = None, None, False
    for p in paras:
        text = plain(p)
        if h1 is None and p['style'] in TITLE_STYLES and text.strip():
            align, h1 = title_html(p); continue
        if RE_LABELS.search(text):
            labels = [l.strip() for l in RE_LABELS.findall(text) if l.strip()]
            notes.append((number, chapter, labels))
            body.append(reel_html(labels, number))
            continue
        if RE_CHAPTER.match(text):
            if open_section:
                body.append('</section>')
            chapter = text.strip()
            body.append(f'<section class="note" id="note-{len(notes) + 1}">')
            open_section = True
            runs = [(k, t, {kk: vv for kk, vv in rp.items() if kk not in ('r_b', 'r_i')}) for k, t, rp in p['runs']]
            body.append(f'<h2 class="chap">{render_runs(runs).strip()}</h2>')
            continue
        if RE_NUMBER.match(text):
            number = text.strip().rstrip('—').strip()
            if int(re.match(r'\d+', number).group()) >= 4:      # notes 4– carry a tag in the letter: the number leads back up to it
                body.append(f'<p class="num"><a class="up" href="and-reconciliation.html#fn-{number}" aria-label="Up to the passage in and Reconciliation">{html.escape(number)}—</a></p>')
            else:
                body.append(f'<p class="num">{html.escape(number)}—</p>')
            continue
        body.append(para_html(p, extra_class=CLASS_FOR_STYLE.get(p['style'], '')))
    if open_section:
        body.append('</section>')
    while body and body[0].startswith('<p class="blank"'): body.pop(0)
    # blank lines around the reels and headings are the document's own spacing; the page has its own
    cleaned = []
    for i, b in enumerate(body):
        if b.startswith('<p class="blank"'):
            nb = next((x for x in body[i + 1:] if not x.startswith('<p class="blank"')), '')
            pb = cleaned[-1] if cleaned else ''
            if nb.startswith(('<nav class="reel"', '<section', '</section>', '<h2')) or pb.startswith(('<nav class="reel"', '<section', '</section>', '<h2', '<p class="num"')):
                continue
        cleaned.append(b)
    body = cleaned
    main = f'''<main class="doc essay notes">
        <a href="and-reconciliation.html" class="back back--corner" aria-label="Back"></a>

        <header class="work-header{(' ' + align) if align else ''}">
            <p class="ordinal">5.1</p>
            {h1}
        </header>

        <div class="essay-body">
            {chr(10).join('            ' + b for b in body).strip()}
        </div>

        <div class="mark"></div>
    </main>'''
    write('notes-on.html', page('notes-on', 'Notes', 'Notes on translating Faerish to English — the Letters of Reconciliation.', main))
    print(f'  notes: {len(notes)} notes, {sum(len(l) for _, _, l in notes)} manuscript links')
    return notes

# ───────────────────────────────────────────────── the manuscript's landing-places (stub)
def build_manuscript(notes):
    body = ['<p class="epi">The manuscript’s full text will stand here. For now these are the places the Notes point to.</p>']
    seen = set()
    for number, chapter, labels in notes:
        body.append(f'<h2 class="chap">{html.escape(chapter or "")}</h2>')
        body.append(f'<p class="num">{html.escape(number or "")}—</p>')
        for l in labels:
            s = slugify(l)
            if s in seen:
                continue
            seen.add(s)
            body.append(f'<h3 class="ms" id="{s}">{html.escape(l)}</h3>')
    main = f'''<main class="doc essay manuscript">
        <a href="notes-on.html" class="back back--corner" aria-label="Back"></a>

        <header class="work-header">
            <h1>The Manuscript</h1>
        </header>

        <div class="essay-body">
            {chr(10).join('            ' + b for b in body).strip()}
        </div>

        <div class="mark"></div>
    </main>'''
    write('manuscript.html', page('manuscript', 'The Manuscript', 'The manuscript — Edith Mina Lyre.', main))

# ───────────────────────────────────────────────── index: the milestone begins at Map I
def build_index():
    write('index.html', '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=this-is-not-the-world.html">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>This is not the world</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #161D1E; color: #E3DAC9; font-family: Georgia, serif; letter-spacing: .3em; }
  a { color: inherit; text-decoration: none; }
  .theme-toggle, .cursor-glow, .wisp, .grain { display: none !important; }
</style>
</head>
<body>
  <a href="this-is-not-the-world.html">THIS IS NOT THE WORLD…</a>
  <script src="../site.js"></script>
</body>
</html>
''')

# ───────────────────────────────────────────────── styles for the additions
EXTRA_CSS = '''

/* ═══════════════════════════════════════════════════════════
   MILESTONE — onward links, the Notes page, and its reels
   ═══════════════════════════════════════════════════════════ */

/* ── the script's ordinal, small above the title ── */
.ordinal {
    font-family: var(--font-display);
    font-size: 0.95rem;
    letter-spacing: 0.22em;
    color: var(--elfin-dim);
    margin: 0 0 0.5rem;
    opacity: 0.85;
}
.work-header.centered .ordinal { text-align: center; }
.work-header.right .ordinal    { text-align: right; }

/* ── onward: under the text, the next page in order sits right; where the
      script's reverse chain runs back toward the start, that sits left ── */
.onward { margin: 3.6rem 0 0.5rem; display: flex; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
.onward .next { margin-left: auto; }
.onward .prev::before {
    content: '←';
    display: inline-block;
    margin-right: 0.6em;
    color: var(--elfin-dim);
    transition: transform 0.4s ease, color 0.4s ease;
}
.onward .prev:hover::before, .onward .prev:focus-visible::before { transform: translateX(-6px); color: var(--silk-deep); }
.onward .next, .onward .prev {
    font-family: var(--font-display);
    font-size: clamp(1.05rem, 0.9rem + 0.5vw, 1.3rem);
    letter-spacing: 0.08em;
    color: var(--elfin);
    background: none;
    text-shadow: 0 0 18px rgba(214, 222, 232, 0.08);
    transition: color 0.55s cubic-bezier(0.16, 1, 0.3, 1), text-shadow 0.55s cubic-bezier(0.16, 1, 0.3, 1), letter-spacing 0.55s cubic-bezier(0.16, 1, 0.3, 1);
}
.onward .next::after {
    content: '→';
    display: inline-block;
    margin-left: 0.6em;
    color: var(--elfin-dim);
    transition: transform 0.4s ease, color 0.4s ease;
}
.onward .next:hover, .onward .next:focus-visible,
.onward .prev:hover, .onward .prev:focus-visible {
    color: var(--silk);
    letter-spacing: 0.11em;
    text-shadow: 0 0 6px rgba(150, 235, 175, 0.6), 0 0 18px rgba(110, 215, 150, 0.45);
}
.onward .next:hover::after, .onward .next:focus-visible::after { transform: translateX(6px); color: var(--silk-deep); }

/* ── the Notes: a chapter tag over each numbered note ── */
.doc h2.chap {
    font-family: var(--font-display);
    font-weight: 400;
    font-style: italic;
    font-size: clamp(1.25rem, 1rem + 0.8vw, 1.7rem);
    letter-spacing: 0.04em;
    text-transform: none;                  /* the site's h2 lowercases; the chapter tags keep their capitals */
    color: var(--silk);
    text-shadow: 0 0 14px rgba(150, 235, 175, 0.22);
    margin: 3.4rem 0 0.3rem;
}
.doc section.note:first-of-type h2.chap { margin-top: 1rem; }
.doc .essay-body p.num {
    font-family: var(--font-display);
    font-size: 1.05rem;
    letter-spacing: 0.12em;
    color: var(--elfin-dim);
    margin: 0 0 1rem;
}
.doc h3.ms {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.2rem;
    letter-spacing: 0.06em;
    color: var(--elfin);
    margin: 1.6rem 0 0.6rem;
    scroll-margin-top: 4rem;
}
.doc .essay-body .note p.quote { margin-left: 4%; }
.doc section.note { scroll-margin-top: 1.5rem; }

/* ── footnote tags: a small numbered mark at the passage a note comments on,
      fast click down to the note; the note's number is the fast click up ── */
.doc a.fn {
    font-family: var(--font-display);
    font-size: 0.68em;
    line-height: 0;
    vertical-align: super;
    margin-left: 0.18em;
    padding: 0.1em 0.2em;
    letter-spacing: 0.04em;
    color: var(--silk-deep);
    background: none;
    text-decoration: none;
    text-shadow: 0 0 8px rgba(150, 235, 175, 0.25);
    scroll-margin-top: 38vh;               /* arriving from a note, the passage sits mid-screen */
    transition: color 0.35s ease, text-shadow 0.35s ease;
}
.doc a.fn:hover, .doc a.fn:focus-visible, .doc a.fn:target {
    color: var(--silk-pale);
    text-shadow: 0 0 6px rgba(150, 235, 175, 0.7), 0 0 16px rgba(110, 215, 150, 0.5), 0 0 36px rgba(70, 185, 115, 0.3);
}
.doc a.fn:target { animation: fn-land 2.4s ease-out 1; }
@keyframes fn-land {
    0%   { color: #fff; text-shadow: 0 0 10px rgba(211, 245, 220, 0.95), 0 0 30px rgba(150, 235, 175, 0.8), 0 0 60px rgba(110, 215, 150, 0.6); }
    100% { color: var(--silk-pale); }
}
.doc .essay-body p.num a.up {
    color: var(--elfin-dim);
    background: none;
    transition: color 0.4s ease, text-shadow 0.4s ease;
}
.doc .essay-body p.num a.up::after {
    content: '↑';
    display: inline-block;
    margin-left: 0.55em;
    font-size: 0.85em;
    opacity: 0.55;
    transition: transform 0.4s ease, opacity 0.4s ease;
}
.doc .essay-body p.num a.up:hover, .doc .essay-body p.num a.up:focus-visible {
    color: var(--silk);
    text-shadow: 0 0 6px rgba(150, 235, 175, 0.6), 0 0 18px rgba(110, 215, 150, 0.4);
}
.doc .essay-body p.num a.up:hover::after { transform: translateY(-3px); opacity: 1; }

/* ── the reel: a fast band of cards under each note, each a door into the
      manuscript. It slows to a stop under the pointer; a card lifts and
      gleams the way Plate IV's pieces do. ── */
.reel {
    --gap: 1.1rem;
    position: relative;
    margin: 1.4rem 0 2.6rem;
    padding: 0.85rem 0;
    border-top: 1px solid rgba(191, 198, 207, 0.22);
    border-bottom: 1px solid rgba(191, 198, 207, 0.22);
    overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
}
.reel-track {
    display: flex;
    width: max-content;
    animation: reel calc(var(--n, 8) * 0.7s) linear infinite;
    will-change: transform;
}
.reel:hover .reel-track, .reel:focus-within .reel-track { animation-play-state: paused; }
.reel-half { display: flex; flex: none; }
@keyframes reel { to { transform: translateX(-50%); } }

.reel .card {
    flex: none;
    position: relative;
    overflow: hidden;
    margin-right: var(--gap);
    padding: 0.42em 1em 0.46em;
    border: 1px solid rgba(191, 198, 207, 0.42);
    border-radius: 0.6em;
    background: rgba(8, 12, 14, 0.55);
    font-family: var(--font-display);
    font-size: clamp(1rem, 0.85rem + 0.4vw, 1.2rem);
    letter-spacing: 0.06em;
    white-space: nowrap;
    color: var(--elfin);
    text-decoration: none;
    transform-origin: 50% 60%;
    transition: transform 0.42s cubic-bezier(0.2, 0.7, 0.2, 1), color 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
}
.reel .card::after {                     /* the sheen that sweeps through on hover */
    content: '';
    position: absolute;
    inset: -40% -60%;
    background: linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.32) 50%, transparent 58%);
    transform: translateX(-120%);
    pointer-events: none;
}
.reel .card:hover, .reel .card:focus-visible {
    color: var(--silk-pale);
    border-color: var(--silk);
    transform: translateY(-3px) scale(1.12);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45), 0 0 10px rgba(150, 235, 175, 0.45), 0 0 28px rgba(110, 215, 150, 0.3);
    z-index: 2;
}
.reel .card:hover::after, .reel .card:focus-visible::after { animation: card-sweep 900ms cubic-bezier(0.3, 0.5, 0.3, 1) both; }
@keyframes card-sweep { from { transform: translateX(-120%); } to { transform: translateX(120%); } }

@media (prefers-reduced-motion: reduce) {
    .reel { overflow-x: auto; -webkit-mask-image: none; mask-image: none; }
    .reel-track { animation: none; }
    .reel-half[aria-hidden="true"] { display: none; }
    .reel .card, .reel .card::after, .onward .next, .onward .next::after { transition: none; animation: none; }
}
'''

def build_css_and_js():
    write('faerieland.css', read('faerieland.css').replace('shared by faerieland.html, mestarmya.html, dear-ama.html',
                                                           'shared by the milestone document pages') + EXTRA_CSS)
    write('milestone.js', MILESTONE_JS)

# ───────────────────────────────────────────────── go
if __name__ == '__main__':
    print(f'building milestone from {SRC}\n            into {OUT}')
    build_css_and_js()
    build_index()
    build_map('this-is-not-the-world.html',     'this-is-not-the-world-ii.html',  '../index.html')
    build_map('this-is-not-the-world-ii.html',  'this-is-not-the-world-iii.html', 'this-is-not-the-world.html')
    build_map('this-is-not-the-world-iii.html', 'plate-iv.html',                  'this-is-not-the-world-ii.html')
    build_plate_iv()
    build_come_with_me()
    build_paxie()
    # (slug, default back, ordinal, next in order, reverse toward the start)
    build_doc('faerieland',            'plate-iv.html',              '2.0', post=faerieland_links)
    build_doc('the-paxiean-histories', 'mestarmya.html',             '4.0', ('left-hand-realism.html',  '4.1 Left Hand Realism'))
    build_doc('left-hand-realism',     'the-paxiean-histories.html', '4.1', ('coda.html',               '4.2 Coda'))
    build_doc('coda',                  'left-hand-realism.html',     '4.2', ('c1da.html',               '4.3 C1DA'))
    build_doc('c1da',                  'coda.html',                  '4.3', ('the-false-cow.html',      '4.4 The False Cow'))
    build_doc('the-false-cow',         'c1da.html',                  '4.4', ('mestarmya.html',          '3.1 Amaldéu’s letter to E'))   # 3.2, Daedalus's note, is not yet written
    build_doc('mestarmya',             'the-false-cow.html',         '3.1', ('dear-ama.html',           '3.0 E’s letter to Amaldéu'),
                                                                            ('the-paxiean-histories.html', '4.0 Pasiphaë’s opening notes'))
    build_doc('dear-ama',              'come-with-me.html',          '3.0', ('and-reconciliation.html', '5.0 and Reconciliation'),
                                                                            ('mestarmya.html',          '3.1 Amaldéu’s letter to E'))
    build_doc('and-reconciliation',    'dear-ama.html',              '5.0', ('notes-on.html',           '5.1 Notes'), post=reconciliation_footnotes)
    notes = build_notes()
    build_manuscript(notes)
    print('done')
