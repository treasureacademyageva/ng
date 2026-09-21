# Tests

Node + jsdom. No test runner — each file is a plain script that prints
`ok -`/`FAIL -` lines and exits non-zero on failure.

```bash
bash ../run-all-tests.sh        # everything, one summary (904 checks)
node regression-14.test.js      # a single suite
```

| File | Covers |
|---|---|
| `regression-NN.test.js` | Behaviour, numbered by the round that added it. Each one loads real pages in jsdom, clicks through them and asserts on the resulting DOM and `localStorage`. |
| `seo.test.js` | Metadata, structured data, sitemap, manifest, image payload budget, layout stability, accessibility. |
| `render-check.js` | Renders a page and dumps errors. Debugging aid, not part of the suite. |
| `smoke-quick.js` | Fast sanity check on a couple of pages. |

## Writing assertions

Prefer floors (`>= 7`) to exact counts for anything that grows — page counts,
navigation buttons, seeded records. Exact counts turn every new feature into a
false failure.

Assert on behaviour rather than on seed data. `db.staffWall` and `db.graduates`
hold real names supplied by the school and will change; a test pinned to
"Mrs Salihu Nanahawa" breaks the day the school sends a correction.

Two gotchas:

- `<script type="application/ld+json">` is data. The harness excludes it when it
  collects inline scripts to execute — do not remove that filter.
- Suites that walk the tree for stale version strings skip `tools/`, because
  these files contain old version strings as literals.
