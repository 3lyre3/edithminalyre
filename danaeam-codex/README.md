# Danæam Lookup Kit

Two self-contained lookup documents plus a hub, dressed in the cloth of
edithminalyre.com (EB Garamond & Cormorant, the void/ember/amber palette,
fog · grain · wisp, and the shared day/night theme — the codex remembers the
same `theme` the rest of the site does). Open any HTML file in a browser;
everything works from the folder, and the wisp joins in when served beside
`/site.js`.

- **Danæam Lexicon Lookup.html** — 1,914 entries: the 1,085-entry record
  unified with the **837-word ledger pass of 2026-07-27** (829 coined entries
  added; 18 forms folded into their existing entries; a handful of pron-only
  enrichments beside). Coined entries carry **pronunciation** and the
  **twelve-language comparative ledger** (ME · IS · GA · EU · DE · LA · CY ·
  DZ · GRC · SA · Q · ON) behind a `ledger ·` toggle. Whole-word English
  search: typing **is** returns the be-family and nothing that merely contains
  "is". Danæam-form search folds diacritics (`gae` finds `gæn`). Click any
  form to copy it. Kin-chips group families (be, negation, questions,
  imperative, year series, cardinals — now with îfy/ghîfy/Yfu/Ghyfu — and the
  new indefinites).
- **Danæam Grammar Lookup.html** — 159 rules & conventions + 200 worked
  examples + the year-name converter (base 2+30). Sealed rooms (§9), emerging
  gaps (§12) and the new **ledger pass** section (the gh- pair rule,
  reduplication, the indefinite paradigm with its table, the ios and ley
  frames, deliberate homonyms, the -e postposition, loanwords, gaps left
  open) are badged. Long record-prose paragraphs itself at (i)(ii)(iii) seams
  — display only; the JSON stays verbatim.
- **index.html** — the hub, shelf-marked 499.999.

## Expanding

1. Edit `lexicon.json`, `grammar.json`, or `examples.json` — copy the shape
   of any existing entry. Optional lexicon fields: `category`, `parents`,
   `crossref`, and (from the ledger pass) `pron` and `ledger`.
2. Run `python3 build_lookups.py` (standard library only).
3. All three HTML files regenerate whole.

Status values display as badges: `canon` (gold) · `active` (honey) ·
`working` (rust) · `coined` (amber — the ledger pass's mark).

## The merge machinery (provenance)

- `Danæam_Comprehensive_Lexicon.md` — the unified dump of 2026-07-27
  (record + Uncoined-Word Worksheet), the merge's source of truth.
- `merge_lexicon.py` — parsed the dump's Part I into the 829 new coined
  entries and the fold-enrichments; assert-counted, refuses to write when the
  ledger does not balance, refuses to run twice. **Six exploded fragment
  pseudo-blocks were dropped and three mashed blocks repaired** (îfy, Yfu and
  Cłepësceán recovered from their host rows' own testimony) — every hand laid
  on the text is recorded in `merge_report.txt`. Beyr · Ceg · Beyrceg remain
  commentary-attested only, awaiting the maker.
- `add_ledger_pass.py` — wove the dump's Part III structure notes into the
  grammar as "The ledger pass".
- `tidy_typography.py` — collapsed 525 HTML-extraction artefacts
  (space-before-punctuation, orphaned possessives); word-for-word identical
  text, full audit in `tidy_log.txt`. Danæam fields (`form`, `pron`,
  `ledger`, `dan`) were never touched.

## Canon notes

- The notes' analytic counting forms (raí-ghíl-ssaighisseith & kin) were
  ruled an error by the maker, 2026-07-21, and are deliberately excluded.
  The year series is the one numeral canon.
- The Oath text in the grammar lookup carries a working date-clause; its
  numeral rendering is under revision.
- The Sfeith pair {20, 21} runs against the other year-stem pairs'
  {odd, odd+1}. Direction unruled — an open watch, badged in the numeral
  entry.
- *shall* has no lexeme — entered n/a on the worksheet; futurity is
  morphological. Recorded under "Gaps left open" in the ledger pass.

Nothing is canon until sealed: Elm rules; the keeper keeps.
