# Test suites — verify-batch2 … verify-batch44 (current truth: 1360 checks)
Each `verify-batchNN.js` locks the features delivered in batch NN. Suites read the site from the repo root (fallback path resolution) and require jsdom.

Run everything: `npm install jsdom --no-audit --no-fund && bash tools/run-all-tests.sh`

Rules for the next agents:
- After ANY data or feature change: update the affected suite's truth (see HANDOVER.md), never delete tests.
- Every version bump (-NN): sed `20260919-NN` + `treasure-vNN` across suites b15 + b26..latest.
- 404.html exists: page-count pins = 41 files.
- Extra utilities (render-check.js, smoke-quick.js, seo.test.js) are kept alongside.
