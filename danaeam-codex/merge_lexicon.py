#!/usr/bin/env python3
"""
merge_lexicon.py — unify the 837-coinage ledger pass into lexicon.json
======================================================================
Reads:   lexicon.json                      (1,085 entries — the codex record)
         Danæam_Comprehensive_Lexicon.md   (Part I — the unified dump of
                                            2026-07-27: record + Uncoined-Word
                                            Worksheet ledger pass)
Writes:  lexicon.json  (in place, only if every assertion balances)
         merge_report.txt  (the full accounting, for the maker's audit)

Principles (the seal_pair tradition):
  - The record is parsed, never re-derived. No POS is invented for coined
    entries — the maker has not ruled their categories.
  - Existing entries keep their accretion order untouched; coined entries
    append after, in the dump's A-Z order.
  - Folded worksheet forms (pron/ledger arriving onto existing entries)
    are matched homograph-aware by (form, gloss); ambiguity is a hard stop,
    not a guess.
  - If the totals do not balance to the dump's declared 1,919 unified
    headwords, nothing is written.
"""
import json, re, sys, pathlib, unicodedata

HERE = pathlib.Path(__file__).parent
MD = HERE / "Danæam_Comprehensive_Lexicon.md"
LEX = HERE / "lexicon.json"

EXPECTED_TOTAL = 1914          # 1919 declared − 6 exploded fragments + 1 reconstructed (Yfu)
EXPECTED_FOLD_BLOCKS = None    # discovered; unique-form count asserted == 18
EXPECTED_FOLD_FORMS = 18

# ---------------------------------------------------------------------------
# TEXTUAL REPAIRS — the dump's worksheet assembler exploded commentary-rich
# rows into fragment pseudo-blocks. Every hand laid on the text is listed
# here and printed to the report. Justifications are the document's own
# testimony (Part III pair-rule; the host rows' swallowed commentary).
# ---------------------------------------------------------------------------
DROP_FORMS = {
    "aodruýscain: another":                       "fragment of the níbísy row (clean aodruýscain block exists)",
    "every number 1-60 pairs with its prior odd": "fragment of the Ghyfu row (the pair-rule, not a word)",
    "subsequent even number, so pairs are coined together)": "fragment of the Ghyfu row (rule tail, not a word)",
    "one more: another beerkeg, please":          "fragment of the níbísy row (phrase gloss, not a headword)",
    "sequentially more: another few beers":       "fragment of the níbísy row (phrase gloss, not a headword)",
    "uain nibísïl-e: another":                    "fragment of the níbísy row (clean uain nibísïl-e block exists)",
}
REPAIR_BLOCKS = {
    # mashed form → (true form, true gloss, true pron, keep_notes, justification)
    "eleven: îfy": ("îfy", "eleven", "eye-vee", False,
        "repaired: ghîfy's row reads «alt. pron. “eye-vee”; also eleven: îfy»; "
        "Part III seals the pair îfy 11 / ghîfy 12; the fragment's «variant of ghîfy» note dies"),
    "brízłœách (breehz-lyeuh'ayk": ("brízłœách", "jealous", "breehz-lyeuh'ayk", True,
        "repaired: inline pron lost its closing paren in the dump"),
    "or* Cłepësceán": ("Cłepësceán", "jackalope (variant)", "clyehp-eh-sheh'uhn", True,
        "repaired: «or* Cłepësceán» is the host row's italicised English connective swallowed "
        "into the bold; Charóiscindeaí's row reads «alt. pron. “clyehp-eh-sheh'uhn”; also or* Cłepësceán»"),
}
RECONSTRUCT = [
    # entries attested inside host-row commentary but exploded out of existence
    {"form": "Yfu", "type": "", "gloss": "fifteen", "notes": "",
     "source": "Uncoined-Word Worksheet — 837-word ledger pass, completed 2026-07-27 "
               "(reconstructed: Ghyfu's row reads «pairs with 15 = Yfu (Ih-vah»; "
               "Part III pair-rule)",
     "status": "coined", "pron": "Ih-vah"},
]
PRON_TO_NOTES = {
    # pron-slot text that is commentary, relocated verbatim into notes
    "Blaotzúl-blaotzúl", "Ffáx", "Glaoscêlintilény", "uferghëa", "wantœ",
}
PRON_RESTORE = {
    # true prons recovered from the níbísy row's swallowed commentary
    "níbísy": "nee-beess-eeh",
    "aodruýscain": "ow-dru'ih-sheh'in",
    "uain nibísïl-e": "wayn nihb-ess-ee'il-eh",
}
UNPROMOTED_WATCH = ["Beyr", "Ceg", "Beyrceg"]   # attested in commentary only — the maker's call

report_lines = []
def rep(s=""):
    report_lines.append(s)
    print(s)

text = MD.read_text(encoding="utf-8")
p2 = text.find("# Part II")
assert p2 > 0, "Part II boundary not found"
part1 = text[:p2]

lexicon = json.loads(LEX.read_text(encoding="utf-8"))
orig_count = len(lexicon)
rep(f"lexicon.json entries at start: {orig_count}")
if any(e.get("status") == "coined" for e in lexicon):
    rep("REFUSED: lexicon.json already carries coined entries — the merge has "
        "already run. Restore the pre-merge lexicon.json before re-running.")
    sys.exit(1)

# ---------- parse Part I into blocks ----------
block_re = re.compile(r"^- \*\*(?P<head>.+)$", re.M)
lines = part1.split("\n")
blocks = []   # each: {"headline": str, "subs": [str, ...]}
cur = None
for ln in lines:
    if ln.startswith("- **"):
        if cur: blocks.append(cur)
        cur = {"headline": ln, "subs": []}
    elif cur is not None and ln.startswith("  - "):
        cur["subs"].append(ln[4:])
    elif cur is not None and re.match(r"^\s{3,}-\s", ln):
        cur["subs"].append(ln.strip()[2:])        # deeper-nested list item
    elif cur is not None and re.match(r"^\s{3,}\S", ln):
        if cur["subs"]: cur["subs"][-1] += " " + ln.strip()   # wrapped line
        else: cur["subs"].append(ln.strip())
    elif cur is not None and ln.strip() == "":
        pass  # blank inside/between blocks
    elif cur is not None and ln.startswith("## "):
        blocks.append(cur); cur = None  # letter header ends a block
    elif cur is not None and not ln.startswith(" "):
        blocks.append(cur); cur = None
if cur: blocks.append(cur)
rep(f"Part I blocks parsed: {len(blocks)}")

HEAD_RE = re.compile(
    r"^- \*\*(?P<form>.+?)\*\*"         # non-greedy: first closing ** ends the form
    r"(?:\s+\*\((?P<pos>.+?)\)\*)?"     # optional *(POS)* — may nest parens inside
    r"(?:\s+—\s+(?P<rest>.*))?$"        # — gloss  `[status]`  ↳ of parent
)
STATUS_RE = re.compile(r"`\[(?P<st>[^\]]+)\]`")
PARENT_RE = re.compile(r"↳\s*of\s+(?P<par>.+?)\s*$")

def parse_block(b):
    m = HEAD_RE.match(b["headline"])
    if not m:
        return None
    form = m.group("form").strip()
    pos = (m.group("pos") or "").strip()
    rest = (m.group("rest") or "").strip()
    status = ""
    sm = STATUS_RE.search(rest)
    if sm:
        status = sm.group("st").strip()
        rest = rest[:sm.start()].rstrip() + " " + rest[sm.end():]
    parent = ""
    pm = PARENT_RE.search(rest)
    if pm:
        parent = pm.group("par").strip()
        rest = rest[:pm.start()].rstrip()
    gloss = rest.strip()
    pron, ledger, source, notes = "", "", "", []
    PRON_RE = re.compile(r'^pron\.\s*[“"](?P<p>.*?)[”"]\s*(?:[;,]\s*(?P<extra>.*))?$')
    for s in b["subs"]:
        s = s.strip()
        if s.startswith("pron."):
            pm2 = PRON_RE.match(s)
            if pm2:
                pron = pm2.group("p").strip()
                if pm2.group("extra"):
                    notes.append(pm2.group("extra").strip())
            else:
                pron = s[len("pron."):].strip().strip("“”\"")
        elif s.startswith("ledger:"):
            ledger = s[len("ledger:"):].strip()
        elif s.startswith("*source:") and s.endswith("*"):
            source = s[len("*source:"):-1].strip()
        else:
            notes.append(s)
    # pron riding inside the bolded form: **fœrm (fuh-orm)** with no pron line
    if not pron:
        fm = re.match(r"^(?P<f>.+?)\s+\((?P<pr>[^()]*['-][^()]*)\)$", form)
        if fm and not re.search(r"\(", fm.group("f")):
            form, pron = fm.group("f").strip(), fm.group("pr").strip()
    return {
        "form": form, "pos": pos, "gloss": gloss.replace("**", ""), "status": status,
        "parent": parent, "pron": pron, "ledger": ledger,
        "source": source, "notes": " ".join(notes).replace("**", "").strip(),
    }

parsed = []
unparsed = []
for b in blocks:
    p = parse_block(b)
    if p is None:
        unparsed.append(b["headline"])
    else:
        parsed.append(p)
if unparsed:
    rep(f"!! UNPARSED headlines ({len(unparsed)}):")
    for u in unparsed: rep(f"   {u}")

# ---------- textual repairs (each reported) ----------
rep("")
rep("— textual repairs —")
kept = []
for p in parsed:
    if p["form"] in DROP_FORMS:
        rep(f"   DROP   {p['form']!r} — {DROP_FORMS[p['form']]}")
        continue
    if p["form"] in REPAIR_BLOCKS:
        tf, tg, tp, keep_notes, note = REPAIR_BLOCKS[p["form"]]
        rep(f"   REPAIR {p['form']!r} → form={tf!r} gloss={tg!r} pron={tp!r}")
        rep(f"          ({note})")
        p["form"], p["gloss"], p["pron"] = tf, tg, tp
        if not keep_notes:
            p["notes"] = ""   # a fragment's fictional note dies with the fragment
    if p["form"] in PRON_TO_NOTES and p["pron"]:
        rep(f"   MOVE   {p['form']!r}: pron-slot commentary → notes: {p['pron']!r}")
        p["notes"] = (p["notes"] + " " if p["notes"] else "") + "(" + p["pron"] + ")"
        p["pron"] = ""
    if p["form"] in PRON_RESTORE:
        old = p["pron"]
        p["pron"] = PRON_RESTORE[p["form"]]
        if old and old != p["pron"]:
            rep(f"   RESTORE {p['form']!r}: pron {old!r} (swallowed commentary) → {p['pron']!r}; commentary → notes")
            p["notes"] = (p["notes"] + " " if p["notes"] else "") + "(row commentary: " + old + ")"
        else:
            rep(f"   RESTORE {p['form']!r}: pron ← {p['pron']!r} (recovered from the níbísy row)")
    kept.append(p)
parsed = kept
rep(f"   RECONSTRUCT + {[e['form'] for e in RECONSTRUCT]!r} (attested in host-row commentary)")
rep(f"   UNPROMOTED (commentary-attested only, for the maker): {UNPROMOTED_WATCH}")
rep("")

# ---------- classify ----------
coined   = [p for p in parsed if p["status"] == "coined"]
odd_stat = [p for p in parsed if p["status"] not in ("", "coined", "active", "working", "canon")]
carried  = [p for p in parsed if p["status"] != "coined"]
folds    = [p for p in carried if p["pron"] or p["ledger"]]
ledger_folds = [p for p in folds if p["ledger"]]
pron_only    = [p for p in folds if not p["ledger"]]

rep(f"coined blocks: {len(coined)}")
rep(f"carried blocks: {len(carried)}  (fold-blocks: {len(folds)} = "
    f"{len(ledger_folds)} ledger-folds + {len(pron_only)} pron-only enrichments)")
rep(f"pron-only enrichments: {[p['form'] for p in pron_only]}")
if odd_stat:
    rep(f"!! blocks with unusual status ({len(odd_stat)}):")
    for p in odd_stat: rep(f"   {p['form']!r} status={p['status']!r} gloss={p['gloss']!r}")

# n/a-style recorded gaps: keep out of the lexicon, note in the report
gaps = [p for p in odd_stat]
coined = [p for p in coined if p not in gaps]

# ---------- fold matching (homograph-aware) ----------
by_form = {}
for i, e in enumerate(lexicon):
    by_form.setdefault(e["form"], []).append(i)

def norm(s):
    s = unicodedata.normalize("NFC", s or "")
    s = re.sub(r"\s+", " ", s).strip().lower()
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return s

fold_hits, fold_misses, consumed = [], [], set()
for f in folds:
    cands = [i for i in by_form.get(f["form"], []) if i not in consumed]
    if not cands:
        fold_misses.append((f, "no entry with this form"))
        continue
    if len(cands) == 1:
        pick = cands[0]
    else:
        exact = [i for i in cands if norm(lexicon[i].get("gloss")) == norm(f["gloss"])]
        if len(exact) == 1:
            pick = exact[0]
        elif len(exact) > 1:
            pick = exact[0]   # identical twins: consume in order
        else:
            fold_misses.append((f, f"ambiguous homographs, no gloss match "
                                   f"(md gloss {f['gloss']!r} vs "
                                   f"{[lexicon[i].get('gloss') for i in cands]!r})"))
            continue
    consumed.add(pick)
    e = lexicon[pick]
    if f["pron"]:   e["pron"] = f["pron"]
    if f["ledger"]: e["ledger"] = f["ledger"]
    fold_hits.append((f["form"], f["gloss"], e.get("gloss", "")))

rep(f"folds matched: {len(fold_hits)}")
for form, mg, jg in fold_hits:
    rep(f"   ✓ {form}  (md: {mg!r} → json: {jg!r})")
if fold_misses:
    rep(f"!! FOLD MISSES ({len(fold_misses)}):")
    for f, why in fold_misses: rep(f"   ✗ {f['form']!r}: {why}")

unique_fold_forms = len({f["form"] for f in ledger_folds})
rep(f"unique ledger-fold forms: {unique_fold_forms} (expect {EXPECTED_FOLD_FORMS}; "
    f"pron-only enrichments ride beside, uncounted)")

# ---------- coined entries → json shape ----------
existing_forms = set(by_form)
collisions = [c for c in coined if c["form"] in existing_forms]
if collisions:
    rep(f"!! COINED/EXISTING FORM COLLISIONS ({len(collisions)}) — these should have been folds:")
    for c in collisions: rep(f"   {c['form']!r} gloss={c['gloss']!r}")

def strip_md(s):
    # italics markers inside loanword forms: *Scale* *truck*-e → Scale truck-e
    return s.replace("*", "")

new_entries = []
for c in coined:
    e = {
        "form": strip_md(c["form"]),
        "type": "",                       # the maker has not ruled a category
        "gloss": c["gloss"],
        "notes": c["notes"],
        "source": c["source"] or "Uncoined-Word Worksheet — 837-word ledger pass, completed 2026-07-27",
        "status": "coined",
    }
    if c["pron"]:   e["pron"] = c["pron"]
    if c["ledger"]: e["ledger"] = c["ledger"]
    if c["parent"]: e["parents"] = [c["parent"]]
    new_entries.append(e)

# reconstructed entries join the coined, in alphabetical station
for r in RECONSTRUCT:
    new_entries.append(dict(r))
new_entries.sort(key=lambda e: unicodedata.normalize("NFD", e["form"]).encode("ascii", "ignore").decode().lower() or e["form"].lower())

# ledger-line sanity: every ledger must open with the ME column
bad_ledgers = [e["form"] for e in new_entries if e.get("ledger") and not e["ledger"].startswith("ME ")]
if bad_ledgers:
    rep(f"!! LEDGERS NOT OPENING WITH 'ME ': {bad_ledgers[:10]}")

missing_pron   = [e["form"] for e in new_entries if "pron" not in e]
missing_ledger = [e["form"] for e in new_entries if "ledger" not in e]
empty_gloss    = [e["form"] for e in new_entries if not e["gloss"]]
rep(f"coined without pron: {len(missing_pron)} {missing_pron[:8]}")
rep(f"coined without ledger: {len(missing_ledger)} {missing_ledger[:8]}")
if empty_gloss:
    rep(f"!! coined with EMPTY GLOSS: {empty_gloss}")

merged = lexicon + new_entries
rep(f"merged total: {orig_count} + {len(new_entries)} = {len(merged)} (expect {EXPECTED_TOTAL})")

# ---------- beacons ----------
beacons = {
    "Méstár": "dear", "æœłíc": "nobody", "îfy": "eleven", "ghîfy": "twelve",
    "Yfu": "fifteen", "Ghyfu": "sixteen", "níbísy": "another", "brízłœách": "jealous",
    "þiníya": None, "óc∆éy •": None, "Strauss": "ostrich", "aartanfu": "suspend",
}
forms_now = {e["form"]: e for e in merged}
beacon_fail = False
for bf, bg in beacons.items():
    hit = forms_now.get(bf)
    if not hit:
        rep(f"!! BEACON MISSING: {bf!r}"); beacon_fail = True
    elif bg and bg not in hit["gloss"]:
        rep(f"!! BEACON GLOSS ODD: {bf!r} gloss={hit['gloss']!r} (wanted ~{bg!r})")
    else:
        extras = " · ".join(x for x in (hit.get("pron", ""), ) if x)
        rep(f"   beacon ✓ {bf} — {hit['gloss']}" + (f"  [{extras}]" if extras else ""))

# Sídia enrichment check
sid = [e for e in merged if e["form"] == "Sídia" and "ledger" in e]
rep(f"   Sídia entries carrying ledger: {len(sid)}")

# ---------- the verdict ----------
ok = (len(merged) == EXPECTED_TOTAL
      and not fold_misses
      and not collisions
      and not unparsed
      and not empty_gloss
      and not beacon_fail
      and not bad_ledgers
      and unique_fold_forms == EXPECTED_FOLD_FORMS)

rep("")
if not ok:
    rep("REFUSED: the ledger does not balance. Nothing written.")
    (HERE / "merge_report.txt").write_text("\n".join(report_lines), encoding="utf-8")
    sys.exit(1)

LEX.write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
rep(f"SEALED: lexicon.json written — {len(merged)} entries "
    f"({orig_count} carried + {len(new_entries)} coined; "
    f"{len(fold_hits)} fold-enrichments on {unique_fold_forms} forms; "
    f"{len(gaps)} recorded gaps kept out: {[g['form'] for g in gaps]!r})")
(HERE / "merge_report.txt").write_text("\n".join(report_lines), encoding="utf-8")
