#!/usr/bin/env python3
"""
tidy_typography.py — normalise HTML-extraction crud in the codex JSONs
======================================================================
The reference's italic-tag boundaries left flanking spaces when the record
was extracted to JSON: "the Síonæyais , the people", "complete :", "former ’s".
This pass collapses ONLY those typographic artefacts. No word changes. Every
touch is logged to tidy_log.txt with before→after context for audit.

Touched fields:
  grammar.json  — section, title, body
  lexicon.json  — gloss, notes
  examples.json — literal, english      (dan is NEVER touched — Danæam spacing
                                         around •, ∆ and tmesis seams is canon)
Never touched: form, pron, ledger, dan, source, anchors.
"""
import json, re, pathlib

HERE = pathlib.Path(__file__).parent
log = []

RULES = [
    (re.compile(r" +([,.;:!?])(?=\s|$|”|\")"), r"\1"),   # space before ASCII punct
    (re.compile(r"\( +"), "("),                          # space after open paren
    (re.compile(r" +\)"), ")"),                          # space before close paren
    (re.compile(r" +’s(?=\s|$|[,.;:)])"), "’s"),         # italics-orphaned possessive
    (re.compile(r"  +"), " "),                           # doubled spaces
]

def tidy(s, where):
    if not s:
        return s, 0
    out, n = s, 0
    for rx, repl in RULES:
        def count_repl(m):
            nonlocal n
            n += 1
            a = max(0, m.start() - 24); b = min(len(out), m.end() + 24)
            log.append(f"  {where}: …{out[a:b]}… → {rx.sub(repl, out[a:b])!r}")
            return m.expand(repl) if isinstance(repl, str) and "\\" in repl else repl
        new = rx.sub(lambda m: (count_repl(m)), out)
        out = new
    return out.strip(), n

def run(fname, fields):
    p = HERE / fname
    data = json.loads(p.read_text(encoding="utf-8"))
    total = 0
    for e in data:
        for f in fields:
            if f in e and isinstance(e[f], str):
                e[f], n = tidy(e[f], f"{fname}:{e.get('form') or e.get('title') or e.get('dan','?')[:20]}.{f}")
                total += n
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{fname}: {total} touches across fields {fields}")
    return total

log.append("tidy_typography.py — audit log")
t = 0
t += run("grammar.json", ["section", "title", "body"])
t += run("lexicon.json", ["gloss", "notes"])
t += run("examples.json", ["literal", "english"])
log.insert(1, f"total touches: {t}")
(HERE / "tidy_log.txt").write_text("\n".join(log), encoding="utf-8")
print(f"total: {t} — full audit in tidy_log.txt")
