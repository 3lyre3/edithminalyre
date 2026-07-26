#!/usr/bin/env python3
"""
add_ledger_pass.py — weave the Comprehensive Lexicon's Part III into grammar.json
=================================================================================
Part III ("Structure notes from the ledger pass", 2026-07-27) states patterns
from the 837 coinages themselves, not imposed on them. It enters the grammar
lookup as its own section, "The ledger pass" (anchor: ledger), text carried
from the dump with only formatting adapted (md bold stripped, bullet lists
run together with · separators; the indefinite paradigm becomes the lookup's
first live table).

Refuses to run twice.
"""
import json, pathlib, sys

HERE = pathlib.Path(__file__).parent
G = HERE / "grammar.json"
grammar = json.loads(G.read_text(encoding="utf-8"))

if any(e.get("anchor") == "ledger" for e in grammar):
    print("REFUSED: 'The ledger pass' section already present.")
    sys.exit(1)

S = "The ledger pass"
A = "ledger"
entries = [
 {"section": S, "anchor": A, "title": "About the ledger pass",
  "body": "Patterns that emerged or were confirmed while coining the 837 — each stated "
          "from the coinages themselves, not imposed on them. Source: the Comprehensive "
          "Lexicon's structure notes, ledger pass completed 2026-07-27. The ledger rows "
          "themselves (twelve comparative languages: ME · IS · GA · EU · DE · LA · CY · "
          "DZ · GRC · SA · Q · ON) ride on each coined entry in the lexicon lookup.",
  "table": []},
 {"section": S, "anchor": A, "title": "Numerals — the gh- pair rule",
  "body": "The lexicon's ruling of 2026-07-23 (aint 1 · ghaint 2 · raí 3 · ghraí 4, with "
          "gh- marking the even member and matching the year-stem pairs Slár 9/Ghslár 10, "
          "Îæth 27/Ghîæth 28, Ínhe 43/Ghínhe 44, Raíwil 49/Ghraíwil 50) is confirmed by "
          "this pass: îfy 11 / ghîfy 12 were coined as a pair under the stated rule that "
          "every number 1–60 pairs with its prior odd or subsequent even number — as were "
          "Yfu 15 / Ghyfu 16. Also from this pass: thrhaithíl 216,000 and thíghráied "
          "12,960,000, alongside miłió.",
  "table": []},
 {"section": S, "anchor": A, "title": "Reduplication",
  "body": "Exact doubling, for actions that consist in their own repetition: "
          "Blaotzúl-blaotzúl applause (cf. Blaotzúlæn, to applaud) · Scratean-scratean "
          "record · Senthith-senthith sense (variant beside Senthithaí) · "
          "Chuffchœm-chuffchœm shortcoming · Mëtmët amount · sumsumæn sweep · Tintin "
          "rumble · mÿmomÿ several · lósëlós obvious.",
  "table": []},
 {"section": S, "anchor": A, "title": "The indefinite paradigm — yel- / uao- / æœ-",
  "body": "A three-way any / some / no series, with -łíc for persons and the ios frame "
          "for things. Adverbial extensions: yelthurn anywhere · yelmá anyway · yelëg "
          "any direction · uaothüsýa sometime. þiníya stands outside the paradigm — the "
          "predicted form would be built on æœ- and the ios frame. Left as coined; "
          "flagged as the one irregular member.",
  "table": [["", "any-", "some-", "no-"],
            ["body", "yełíc", "uaołíc", "æœłíc"],
            ["thing", "ios yelthas", "ios uaothas", "þiníya"],
            ["one", "nÿel", "—", "—"]]},
 {"section": S, "anchor": A, "title": "The ios frame",
  "body": "ios thas (that + what) = thing · ios thüs (that + when) = then. These make "
          "ios yelthas and ios uaothas regular derivations rather than one-offs.",
  "table": []},
 {"section": S, "anchor": A, "title": "The ley frame — Lén, Glaosc-",
  "body": "Lén is the ley. Glaosc- is the automaton (Glaoscá). The compounds are not "
          "about air or ground but about iron running on a line that was already there — "
          "the dark rails in the starblack sky are the primary sense, the terrestrial "
          "ones the borrowing: Glaoscêlintilény aircraft (automatic-ley-liner) · "
          "Glaoscêlintiługy airliner · glaosclíntách railside · Łége route · Glaoscléÿ "
          "phone.",
  "table": []},
 {"section": S, "anchor": A, "title": "The sei- / sein- cluster",
  "body": "Six coinages for re-/back- verbs share an onset: seinutscu recall · seïldhu "
          "recollect · seifandræ respond · Seinhœmaí result · seïnaigg retract · "
          "seiffrathí withdraw. Outside it: erinæn remember · sininithíáchæ repeat · "
          "Faníucæí reply · Lebatscúne respect. Undecided whether this is a morpheme or "
          "a coincidence of ear.",
  "table": []},
 {"section": S, "anchor": A, "title": "Deliberate homonyms",
  "body": "Four pairs share one form by decision, not accident: góïyth — akin / similar "
          "· yiusétæn — put / set (put was recoined from údúsétæn to merge them) · Laíaí "
          "— sight / vision · sy — such / thus.",
  "table": []},
 {"section": S, "anchor": A, "title": "The -e postposition",
  "body": "Hyphen-hung, placed after its topic: Saíny Wil-e (Waker All-of) · scónách "
          "waíl-e (always already) · Thexa Ür-e (urtext) · Steam niyail-e (unison) · "
          "Scale truck-e (truck) · sógjæn uÿth-e (surpass) · uain Beyrceg nibísïl-e "
          "a'ithæ'nn (another beerkeg, please).",
  "table": []},
 {"section": S, "anchor": A, "title": "Directional pairs",
  "body": "Afyáëg sunrise / Felyáëg sunset — a shared -yáëg with af- and fel- as the "
          "directional elements, now productive.",
  "table": []},
 {"section": S, "anchor": A, "title": "Kinship",
  "body": "Sídia — sibling, ungendered; entered at sister, with the explicit ruling that "
          "there are no gendered sibling titles. It is the only kin term on the 837-word "
          "sheet, so nothing else needs to agree with it.",
  "table": []},
 {"section": S, "anchor": A, "title": "Loanwords accepted",
  "body": "Strauss ostrich · Saffîr sapphire · Fótca vodka · Stigma tattoo · "
          "Thelefigjíon television · üranyum uranium · uloominíäm aluminium · Scale "
          "truck-e truck · óc∆éy • okay (with the ∆ up-trill).",
  "table": []},
 {"section": S, "anchor": A, "title": "Gaps left open",
  "body": "shall — entered n/a; no lexeme, future handled morphologically. þiníya — "
          "outside the indefinite paradigm, as above. Angúl ring — built on angulus "
          "rather than the row's anulus; angulus is the Chœin (angle) row. Kept as "
          "coined. Beyr, Ceg, Beyrceg — attested inside the níbísy row's commentary "
          "(uain Beyrceg nibísïl-e a'ithæ'nn) but not coined as headwords; awaiting the "
          "maker's word.",
  "table": []},
]

grammar.extend(entries)
G.write_text(json.dumps(grammar, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"woven: {len(entries)} entries into section '{S}' — grammar now {len(grammar)} rules")
