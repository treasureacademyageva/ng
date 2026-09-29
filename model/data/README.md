# Data policy and layout

Every corpus item must have a matching record in `sources.json` with source URL, creator, exact license, permitted use, language, level, subject, retrieval date, checksum and review state.

- `raw/`: downloaded originals; immutable and gitignored.
- `licensed/`: extracted text with attribution sidecars; gitignored.
- `cleaned/`: normalized/deduplicated documents; gitignored.
- `pretraining/`: deterministic train/validation token files; gitignored.
- `instruction/`: reviewed conversation JSONL; private records prohibited.
- `preference/`: reviewed chosen/rejected answer pairs.
- `evaluation/`: committed held-out prompts and expected behavior.

## License gates

Allowed by default: school-owned material, public-domain works verified per jurisdiction, CC0, CC BY, CC BY-SA with attribution/share-alike tracking, and original reviewed curriculum text.

Not allowed by default: unknown license, all-rights-reserved pages, paid textbooks, copied exam banks, personal records, private chats, or CC BY-NC content for a potentially commercial school product.

A URL being publicly accessible does **not** grant training rights.
