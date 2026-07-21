# Danæam Lookup Kit

Two self-contained lookup documents, built 2026-07-21. Open either HTML file in any browser — no internet, no install, works from the folder.

- **Danæam Lexicon Lookup.html** — 864 entries (reference §2 + Final-Boss Haul + All-Coinages concordance + session 2026-07-21: year series, Oath coinages). Whole-word English search: typing **is** returns the whole be-family and nothing that merely contains "is" (*incident* and *history* stay home). Also searches Danæam forms with diacritic folding (type `gae` to find `gæn`), number words (`nine`, `forty-nine`), and light stems (`rape` finds `un-raped-being`). Click any form to copy it. Kin-chips group families (be, give/exist, negation, questions, imperative, year series). Empty the box to browse A–Z.
- **Danæam Grammar Lookup.html** — 132 rules & conventions + 175 worked examples + the year-name converter (base 2+30: I.T. ↔ Danæam, canon-year shortcuts, unmade stems report themselves as awaiting the maker). Sealed rooms (§9) and emerging gaps (§12) are badged.

## Expanding

1. Edit `lexicon.json`, `grammar.json`, or `examples.json` — copy the shape of any existing entry.
2. Run `python3 build_lookups.py` (standard library only).
3. Both HTML files regenerate whole. `index.html` is a small hub linking the two.

### Entry shapes

```json
lexicon.json:  {"form": "Slár", "type": "numeral (year series)", "gloss": "9",
                "notes": "…", "source": "session 2026-07-21, the maker",
                "status": "canon"}
grammar.json:  {"section": "Numerals & dating", "anchor": "num", "title": "…",
                "body": "…", "table": []}
examples.json: {"dan": "…", "literal": "…", "english": "…", "type": "existential"}
```

Optional lexicon fields: `"category"`, `"parents": ["…"]`, `"crossref": true`.
Status values display as badges: `canon`/`active` (green), `working` (amber).

## Canon notes

- The notes' analytic counting forms (raí-ghíl-ssaighisseith & kin) were ruled an
  error by the maker, 2026-07-21, and are deliberately excluded. The year series
  is the one numeral canon.
- The Oath text in the grammar lookup carries a working date-clause; its numeral
  rendering is under revision.
- The Sfeith pair {20, 21} runs against the other year-stem pairs' {odd, odd+1}.
  Direction unruled — an open watch, badged in the numeral entry.

Nothing is canon until sealed: Elm rules; the keeper keeps.
