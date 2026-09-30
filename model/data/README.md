# Data policy and layout

Every corpus item must have a matching record in `sources.json` with source URL, creator, exact license, permitted use, language, level, subject, retrieval date, checksum and review state.

- `raw/`: downloaded originals; immutable and gitignored.
- `licensed/`: extracted PDF/EPUB text; gitignored. Attribution and exact checksums remain in the manifest/lockfile.
- `cleaned/`: normalized/deduplicated documents; gitignored.
- `staging/`: reproducible candidate extractions and duplicate-audit reports awaiting rights/content/human gates; gitignored and never read by training preparation.
- `reviews/`: committed human-review packets and qualified-language review records; pending is valid, but only complete named approvals can pass the readiness gate.
- `source-candidates.json`: researched intake queue; never grants training approval.
- `readiness-policy.json`: machine-readable corpus, balance, review and benchmark gates.
- `pretraining/`: deterministic train/validation token files; gitignored.
- `instruction/`: reviewed conversation JSONL; private records prohibited.
- `preference/`: reviewed chosen/rejected answer pairs.
- `evaluation/`: committed held-out prompts and expected behavior.

## License gates

Allowed by default: school-owned material, public-domain works verified per jurisdiction, CC0, CC BY, CC BY-SA with attribution/share-alike tracking, and original reviewed curriculum text.

Not allowed by default: unknown license, all-rights-reserved pages, paid textbooks, copied exam banks, personal records, private chats, or CC BY-NC content for a potentially commercial school product.

A URL being publicly accessible does **not** grant training rights.
