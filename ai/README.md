# Treasure Support AI — backend (optional)

The chatbot on the website works with no server at all. This backend is the
upgrade path, not a requirement.

| | Browser only (default) | With this backend |
|---|---|---|
| Retrieval | TF-IDF + cosine | sentence-embedding vectors |
| Answer | retrieved passage | LLM-written, grounded in the passage |
| History | this device | follows the parent across devices |
| Analytics | this device | every visitor, in one database |
| Cost | none | a server, and LLM tokens if enabled |

## Run it

```bash
pip install -r ai/requirements.txt
python3 -m uvicorn ai.main:app --host 0.0.0.0 --port 8090
```

Then, once, in the browser console on the site:

```js
localStorage.setItem('treasure_ai_cfg', JSON.stringify({url:'http://localhost:8090', enabled:true}))
```

Remove that key and the site goes straight back to browser-only.

## Environment

| Variable | Effect if unset |
|---|---|
| `DATABASE_URL` | SQLite file at `ai/chat.db` |
| `OPENAI_API_KEY` | no LLM; the retrieved passage is returned verbatim |
| `LLM_MODEL` | `gpt-4o-mini` |
| `TREASURE_AI_CONF` | confidence bar, default `0.34` |

Every dependency is optional by design. No model, no database and no API key
still gives a working `/ask`.

## Endpoints

```
GET  /health              what is actually switched on
POST /ask                 question in, answer or handoff out
POST /feedback            resolved / not resolved
POST /handoff             whatsapp (urgent) or ticket (can wait)
GET  /history?account=..  a parent's saved conversation
GET  /analytics           totals, resolution rate, top questions, gaps
POST /reindex             reload kb.json after rebuilding it
```

Re-run `python3 tools/build-kb.py` then `POST /reindex` whenever site content
changes.
