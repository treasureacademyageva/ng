# NAPPS English and mathematics alignment

Status: **authorized for original authoring; aligned to the 2025 national structure; not claimed as NAPPS-issued**

Research date: 30 September 2026

## What was found

The public NAPPS website (`https://napps.com.ng/`) and member portal (`https://napps.ng/`) do not expose a public Primary 1–6 English/Mathematics teaching-scheme document that can be edition-checked without member access.

The newest complete public web series found is a six-page Primary 1–6 series published on 29 November 2025 and modified on 19 December 2025. Each page says it covers all three terms and claims compliance with the new NERDC curriculum and NAPPS:

- `https://schemeofwork.com/primary-1-scheme-of-work-unified/`
- `https://schemeofwork.com/primary-2-scheme-of-work-unified/`
- `https://schemeofwork.com/primary-3-scheme-of-work-unified/`
- `https://schemeofwork.com/primary-4-scheme-of-work-unified/`
- `https://schemeofwork.com/primary-5-scheme-of-work-unified/`
- `https://schemeofwork.com/primary-6-scheme-of-work-unified/`

This is a **third-party NAPPS-alignment claim**, not proof that NAPPS issued or approved the pages. The extracted index covers all 36 class/subject/term combinations and contains 328 schedule rows, of which 239 are instructional topics. Nine combinations, especially Primary 4, have fewer than eight published rows, so the topic sequence must not be described as a complete official NAPPS edition.

The series was cross-checked against the Federal Ministry of Education's 3 September 2025 curriculum release and NERDC's revised 9-Year Basic Education Curriculum implementation strategy. It uses the new Primary 1–3 and Primary 4–6 subject structures, including Nigerian History, Social and Citizenship Studies, Basic Digital Literacy and Pre-vocational Studies. Its practical, communication, problem-solving, leadership and digital-era topic framing is also consistent with the official competency-based strategy. The owner therefore authorised it for **original lesson planning**.

Official cross-checks:

- `https://education.gov.ng/wp-content/uploads/2025/09/FG-OVERHAULS-CURRICULUM.pdf`
- `https://www.nerdc.gov.ng/content_manager/Revised%209%20Year%20BEC%20Implementation%20Strategy%203.pdf`

Two HeadTeacher.ng pages advertise free 2025 NAPPS downloads for Primary 1–3 and Primary 4–6, but file delivery is restricted to its app. No access control was bypassed. A paid Edudelight product was also found, but it was not purchased because its edition authority and model-use rights are not established.

## How it is being used

`data/authoring/napps-primary-english-mathematics-alignment.csv` stores only week labels and topic headings. It deliberately excludes source explanations, objectives, activities and lesson text.

Every row is currently:

- `ALIGNED_TO_2025_NATIONAL_STRUCTURE_NOT_NAPPS_ISSUED`;
- `READY_FOR_ORIGINAL_AUTHORING`; and
- `training_eligible: false`.

The index now guides the school-owned authoring plan. It is not corpus text and must not be passed to the tokenizer or model trainer. New lessons must be written originally for Treasure Academy Ageva under the already recorded internal-use rights and then receive teacher and safeguarding review.

## Evidence required to claim an official NAPPS edition

Original authoring may proceed from the cross-checked public index. However, before calling the weekly sequence “NAPPS-issued” or “official NAPPS”, supply the current Primary 1–6 NAPPS teaching-scheme PDF or scans used by Treasure Academy Ageva. The intake process must record:

1. document title, issuing body, edition/session and acquisition channel;
2. file SHA-256 and page count;
3. English and mathematics coverage for Primary 1–6 and all three terms;
4. differences from the public planning index;
5. permission scope — alignment only unless explicit model-training rights exist; and
6. school confirmation that the edition is the one currently in use.

No lesson drafting or training approval is inferred merely because a public page uses the NAPPS name.

## Commands

```bash
python3 scripts/fetch_napps_alignment.py
python3 scripts/validate_napps_alignment.py
```

Raw HTML and reports remain in ignored `data/staging/napps-alignment/`. Only the provenance manifest and limited topic index are committed.
