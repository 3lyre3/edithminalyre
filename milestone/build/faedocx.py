"""docx → structured paragraphs → site HTML, keeping the formatting pandoc drops:
alignment (including alignment inherited from a paragraph style), left / first-line /
hanging indents, tab characters, manual line breaks, blank paragraphs, italics, bold,
underline, small caps, superscript / subscript."""
import re, zipfile, html, sys
from xml.etree import ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{%s}' % NS['w']

def _bool(el):
    """<w:i/> is on; <w:i w:val="0"/> is off; absent is None (inherit)."""
    if el is None: return None
    v = el.get(W + 'val')
    return v not in ('0', 'false')

class Doc:
    def __init__(self, path):
        z = zipfile.ZipFile(path)
        self.root = ET.fromstring(z.read('word/document.xml'))
        sect = self.root.find('.//w:sectPr', NS)
        self.text_width = 9360   # Letter with 1in margins, if the section says nothing
        if sect is not None:
            sz = sect.find('w:pgSz', NS); mar = sect.find('w:pgMar', NS)
            if sz is not None and mar is not None:
                self.text_width = int(sz.get(W + 'w')) - int(mar.get(W + 'left', 1440)) - int(mar.get(W + 'right', 1440))
        self.styles = {}
        st = ET.fromstring(z.read('word/styles.xml'))
        self.docdefaults = self._props(st.find('w:docDefaults/w:pPrDefault/w:pPr', NS),
                                       st.find('w:docDefaults/w:rPrDefault/w:rPr', NS))
        for s in st.findall('w:style', NS):
            sid = s.get(W + 'styleId')
            self.styles[sid] = dict(
                based=(s.find('w:basedOn', NS).get(W + 'val') if s.find('w:basedOn', NS) is not None else None),
                name=(s.find('w:name', NS).get(W + 'val') if s.find('w:name', NS) is not None else sid),
                props=self._props(s.find('w:pPr', NS), s.find('w:rPr', NS)))

    def _props(self, ppr, rpr):
        p = {}
        if ppr is not None:
            jc = ppr.find('w:jc', NS)
            if jc is not None: p['jc'] = jc.get(W + 'val')
            ind = ppr.find('w:ind', NS)
            if ind is not None:
                for k in ('left', 'start', 'right', 'firstLine', 'hanging'):
                    v = ind.get(W + k)
                    if v is not None: p['ind_' + ('left' if k == 'start' else k)] = int(v)
                if ind.get(W + 'firstLine') is not None and ind.get(W + 'hanging') is None: p['ind_hanging'] = 0
                if ind.get(W + 'hanging') is not None and ind.get(W + 'firstLine') is None: p['ind_firstLine'] = 0
            sp = ppr.find('w:spacing', NS)
            if sp is not None:
                for k in ('before', 'after', 'line'):
                    v = sp.get(W + k)
                    if v is not None: p['sp_' + k] = int(v)
        if rpr is not None:
            for k in ('i', 'b', 'u', 'smallCaps', 'caps'):
                el = rpr.find('w:' + k, NS)
                if el is not None: p['r_' + k] = _bool(el) if k != 'u' else (el.get(W + 'val') != 'none')
            va = rpr.find('w:vertAlign', NS)
            if va is not None: p['r_vert'] = va.get(W + 'val')
            sz = rpr.find('w:sz', NS)
            if sz is not None: p['r_sz'] = int(sz.get(W + 'val'))
        return p

    def style_chain(self, sid):
        """Resolved properties for a style: docDefaults ← basedOn chain ← the style."""
        chain, seen = [], set()
        while sid and sid in self.styles and sid not in seen:
            seen.add(sid); chain.append(self.styles[sid]['props']); sid = self.styles[sid]['based']
        out = dict(self.docdefaults)
        for props in reversed(chain): out.update(props)
        return out

    def paragraphs(self):
        body = self.root.find('w:body', NS)
        for p in body.iter(W + 'p'):
            ppr = p.find('w:pPr', NS)
            sid = None
            if ppr is not None and ppr.find('w:pStyle', NS) is not None:
                sid = ppr.find('w:pStyle', NS).get(W + 'val')
            props = self.style_chain(sid or 'Normal')
            props.update(self._props(ppr, None))
            runs = []
            for child in p:
                if child.tag == W + 'r' or child.tag == W + 'hyperlink':
                    rs = [child] if child.tag == W + 'r' else child.findall('w:r', NS)
                    for r in rs:
                        rpr = r.find('w:rPr', NS)
                        rp = dict((k, v) for k, v in props.items() if k.startswith('r_'))
                        # run style (rStyle) then direct run props
                        if rpr is not None and rpr.find('w:rStyle', NS) is not None:
                            rp.update((k, v) for k, v in self.style_chain(rpr.find('w:rStyle', NS).get(W + 'val')).items() if k.startswith('r_'))
                        rp.update(self._props(None, rpr))
                        for el in r:
                            if el.tag == W + 't': runs.append(('t', el.text or '', rp))
                            elif el.tag == W + 'tab': runs.append(('tab', '', rp))
                            elif el.tag == W + 'br': runs.append(('br', '', rp))
                            elif el.tag == W + 'sym': runs.append(('t', '?', rp))
            yield dict(style=sid or 'Normal', stylename=self.styles.get(sid or 'Normal', {}).get('name', sid), props=props, runs=runs)

# ------------------------------------------------------------------ rendering
def render_runs(runs):
    out = []
    def wrap(txt, rp):
        s = html.escape(txt)
        if rp.get('r_vert') == 'superscript': s = f'<sup>{s}</sup>'
        elif rp.get('r_vert') == 'subscript': s = f'<sub>{s}</sub>'
        if rp.get('r_smallCaps'): s = f'<span class="sc">{s}</span>'
        if rp.get('r_caps'): s = f'<span class="caps">{s}</span>'
        if rp.get('r_u'): s = f'<span class="u">{s}</span>'
        if rp.get('r_b'): s = f'<strong>{s}</strong>'
        if rp.get('r_i'): s = f'<em>{s}</em>'
        return s
    # merge adjacent text runs with identical formatting so <em>a</em><em>b</em> becomes <em>ab</em>
    merged = []
    for kind, txt, rp in runs:
        key = tuple(sorted((k, v) for k, v in rp.items()))
        if kind == 't' and merged and merged[-1][0] == 't' and merged[-1][2] == key:
            merged[-1] = ('t', merged[-1][1] + txt, key, rp)
        else:
            merged.append((kind, txt, key, rp))
    for kind, txt, key, rp in merged:
        if kind == 't': out.append(wrap(txt, rp))
        elif kind == 'tab': out.append('<span class="tab"></span>')
        elif kind == 'br': out.append('<br>')
    return ''.join(out)

TEXT_WIDTH = 9360
def twips_pct(tw):
    """twips → percent of the document's text column, so a half-inch indent on a
    six-and-a-half-inch page is the same fraction of the web column."""
    return round(100 * tw / TEXT_WIDTH, 1)

def para_html(p, heading_tag=None, extra_class=''):
    props = p['props']
    text = render_runs(p['runs'])
    if not text.strip():
        return '<p class="blank" aria-hidden="true"></p>'
    classes = [c for c in [extra_class] if c]
    styles = []
    jc = props.get('jc')
    if jc == 'center': classes.append('centered')
    elif jc == 'right' or jc == 'end': classes.append('right')
    elif jc == 'both': pass
    left = props.get('ind_left', 0); first = props.get('ind_firstLine', 0); hang = props.get('ind_hanging', 0)
    if jc in ('center', 'right', 'end'): first = 0        # a first-line indent has no visible meaning on a centred or right-set line
    if hang:
        if left: styles.append(f'margin-left:{twips_pct(left)}%')
        styles.append(f'text-indent:-{twips_pct(hang)}%')
    else:
        if left: styles.append(f'margin-left:{twips_pct(left)}%')
        if first: styles.append(f'text-indent:{twips_pct(first)}%')
    if props.get('ind_right'): styles.append(f'margin-right:{twips_pct(props["ind_right"])}%')
    if (any(k == 'tab' for k, _, _ in p['runs']) or hang or left) and jc not in ('center', 'right', 'end'): classes.append('ragged')
    tag = heading_tag or 'p'
    cls = f' class="{" ".join(classes)}"' if classes else ''
    sty = f' style="{"; ".join(styles)}"' if styles else ''
    return f'<{tag}{cls}{sty}>{text}</{tag}>'

def dump(path):
    d = Doc(path)
    print('text column:', d.text_width, 'twips')
    for i, p in enumerate(d.paragraphs()):
        pr = p['props']
        fl = ''.join(k[2] for k in ('r_i', 'r_b', 'r_u') if pr.get(k))
        ind = ' '.join(f'{k[4:]}={v}' for k, v in pr.items() if k.startswith('ind_') and v)
        txt = ''.join(t if k == 't' else ('⇥' if k == 'tab' else '↵') for k, t, _ in p['runs'])
        runfl = ''.join(sorted(set(''.join(k[2] for k in ('r_i', 'r_b', 'r_u') if rp.get(k)) + ('^' if rp.get('r_vert') == 'superscript' else '') for _, _, rp in p['runs'])))
        print(f'{i:3} {p["style"][:14]:14} {str(pr.get("jc","-")):6} {ind:26} {fl:2}{runfl:4} | {txt[:72]!r}')

if __name__ == '__main__':
    dump(sys.argv[1])
