"""
Treasure Support AI - optional FastAPI backend.

The website works without this. The browser runs its own TF-IDF retrieval, so
the chatbot is never dead. Run this when you want the upgrades that genuinely
need a server:

  * real sentence-embedding vector search instead of TF-IDF
  * an LLM writing the answer in its own words
  * conversation history that follows a parent across devices
  * analytics gathered from everyone, not just one browser

Start it:

    pip install -r ai/requirements.txt
    python3 -m uvicorn ai.main:app --host 0.0.0.0 --port 8090

Point the site at it from the browser console, once:

    localStorage.setItem('treasure_ai_cfg',
      JSON.stringify({url:'http://localhost:8090', enabled:true}))

Everything degrades: no model installed falls back to TF-IDF, no database
falls back to memory, no LLM key falls back to returning the retrieved
passage. Nothing here can take the website down.
"""
from __future__ import annotations

import json
import math
import os
import re
import sqlite3
import time
from typing import Any, Dict, List, Optional

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
except ImportError:  # pragma: no cover
    raise SystemExit("Install the dependencies first:  pip install -r ai/requirements.txt")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB_PATH = os.path.join(ROOT, "assets", "data", "kb.json")

# Postgres if DATABASE_URL is set, otherwise a local SQLite file so the thing
# runs with zero setup.
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
SQLITE_PATH = os.environ.get("TREASURE_AI_DB", os.path.join(ROOT, "ai", "chat.db"))
LLM_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
LLM_URL = os.environ.get("LLM_URL", "https://api.openai.com/v1/chat/completions")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
CONF_BAR = float(os.environ.get("TREASURE_AI_CONF", "0.34"))
WHATSAPP = "09063932487"

app = FastAPI(title="Treasure Support AI", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # a public school site; no credentials are sent
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- retrieval
class Retriever:
    """Sentence embeddings when the model is available, TF-IDF when it is not.

    The fallback is not a toy: it is the same maths the browser runs, so the
    answers stay consistent whichever path serves them.
    """

    def __init__(self) -> None:
        self.docs: List[Dict[str, Any]] = []
        self.mode = "tfidf"
        self.model = None
        self.emb = None
        self.idf: Dict[str, float] = {}
        self.vecs: List[Dict[str, float]] = []

    def load(self) -> None:
        if not os.path.exists(KB_PATH):
            raise RuntimeError("kb.json missing - run: python3 tools/build-kb.py")
        with open(KB_PATH, encoding="utf-8") as fh:
            self.docs = json.load(fh).get("docs", [])

        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            name = os.environ.get("TREASURE_AI_MODEL", "all-MiniLM-L6-v2")
            self.model = SentenceTransformer(name)
            texts = [d["title"] + ". " + d["keywords"] + ". " + d["text"] for d in self.docs]
            self.emb = self.model.encode(texts, normalize_embeddings=True,
                                         show_progress_bar=False)
            self.mode = "embeddings"
        except Exception:
            self._build_tfidf()

    # -- tf-idf fallback ----------------------------------------------------
    STOP = set(("a an the is are was were be been being do does did have has had i me my we "
                "our you your he she it they them this that these those of in on at to for "
                "with from by about as into like through after over between out and or but if "
                "then than so because while can could will would should may might must please "
                "what which who where when why how there here").split())

    @classmethod
    def _tok(cls, text: str) -> List[str]:
        out = []
        for w in re.sub(r"[^a-z0-9\s]", " ", str(text).lower()).split():
            if len(w) < 2 or w in cls.STOP:
                continue
            if len(w) > 4 and w.endswith("ies"):
                w = w[:-3] + "y"
            elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
                w = w[:-1]
            out.append(w)
        return out

    def _build_tfidf(self) -> None:
        df: Dict[str, int] = {}
        toks = []
        for d in self.docs:
            t = self._tok(d["title"] + " " + d["keywords"] + " " + d["text"])
            toks.append(t)
            for w in set(t):
                df[w] = df.get(w, 0) + 1
        n = max(1, len(self.docs))
        self.idf = {w: math.log(1 + n / c) for w, c in df.items()}
        self.vecs = [self._vec(t, self.docs[i]) for i, t in enumerate(toks)]

    def _vec(self, toks: List[str], doc: Optional[Dict[str, Any]]) -> Dict[str, float]:
        tf: Dict[str, int] = {}
        for w in toks:
            tf[w] = tf.get(w, 0) + 1
        boost = set(self._tok(doc["title"] + " " + doc["keywords"])) if doc else set()
        v: Dict[str, float] = {}
        norm = 0.0
        for w, c in tf.items():
            weight = (1 + math.log(c)) * self.idf.get(w, 1.0) * (2.2 if w in boost else 1.0)
            v[w] = weight
            norm += weight * weight
        norm = math.sqrt(norm) or 1.0
        return {w: x / norm for w, x in v.items()}

    def search(self, question: str, k: int = 4) -> List[Dict[str, Any]]:
        if self.mode == "embeddings":
            import numpy as np  # noqa: WPS433
            q = self.model.encode([question], normalize_embeddings=True)[0]
            scores = self.emb @ q
            order = scores.argsort()[::-1][:k]
            return [{"doc": self.docs[int(i)], "score": float(scores[int(i)])} for i in order]

        qv = self._vec(self._tok(question), None)
        out = []
        for i, dv in enumerate(self.vecs):
            dot = sum(w * dv[t] for t, w in qv.items() if t in dv)
            if dot > 0:
                out.append({"doc": self.docs[i], "score": dot})
        out.sort(key=lambda x: -x["score"])
        return out[:k]


RETRIEVER = Retriever()


# ----------------------------------------------------------------- storage
class Store:
    """Postgres when DATABASE_URL is set, SQLite otherwise."""

    def __init__(self) -> None:
        self.pg = None
        self.kind = "sqlite"
        if DATABASE_URL:
            try:
                import psycopg2  # type: ignore
                self.pg = psycopg2.connect(DATABASE_URL)
                self.pg.autocommit = True
                self.kind = "postgres"
            except Exception:
                self.pg = None
        self._ensure()

    def _conn(self):
        if self.pg:
            return self.pg
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure(self) -> None:
        serial = "serial primary key" if self.pg else "integer primary key autoincrement"
        ts = "timestamptz default now()" if self.pg else "text default (datetime('now'))"
        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            "create table if not exists conversations ("
            " id %s, account text, session_id text, started %s)" % (serial, ts))
        cur.execute(
            "create table if not exists messages ("
            " id %s, conversation_id integer, role text, content text,"
            " topic text, confidence real, created %s)" % (serial, ts))
        cur.execute(
            "create table if not exists events ("
            " id %s, kind text, question text, topic text, account text,"
            " confidence real, created %s)" % (serial, ts))
        if not self.pg:
            conn.commit()
            conn.close()

    def log_event(self, kind: str, question: str = "", topic: str = "",
                  account: str = "", confidence: float = 0.0) -> None:
        conn = self._conn()
        cur = conn.cursor()
        ph = "%s" if self.pg else "?"
        cur.execute(
            "insert into events (kind, question, topic, account, confidence) "
            "values (%s, %s, %s, %s, %s)" % (ph, ph, ph, ph, ph),
            (kind, question[:400], topic[:200], account[:120], float(confidence)))
        if not self.pg:
            conn.commit()
            conn.close()

    def save_message(self, account: str, session_id: str, role: str,
                     content: str, topic: str = "", confidence: float = 0.0) -> None:
        conn = self._conn()
        cur = conn.cursor()
        ph = "%s" if self.pg else "?"
        cur.execute("select id from conversations where session_id = %s" % ph, (session_id,))
        row = cur.fetchone()
        if row:
            cid = row[0]
        else:
            if self.pg:
                cur.execute("insert into conversations (account, session_id) "
                            "values (%s, %s) returning id", (account, session_id))
                cid = cur.fetchone()[0]
            else:
                cur.execute("insert into conversations (account, session_id) values (?, ?)",
                            (account, session_id))
                cid = cur.lastrowid
        cur.execute(
            "insert into messages (conversation_id, role, content, topic, confidence) "
            "values (%s, %s, %s, %s, %s)" % (ph, ph, ph, ph, ph),
            (cid, role, content[:4000], topic[:200], float(confidence)))
        if not self.pg:
            conn.commit()
            conn.close()

    def history(self, account: str, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self._conn()
        cur = conn.cursor()
        ph = "%s" if self.pg else "?"
        cur.execute(
            "select m.role, m.content, m.topic, m.created from messages m "
            "join conversations c on c.id = m.conversation_id "
            "where c.account = %s order by m.id desc limit %s" % (ph, ph),
            (account, limit))
        rows = [{"role": r[0], "content": r[1], "topic": r[2], "t": str(r[3])}
                for r in cur.fetchall()]
        if not self.pg:
            conn.close()
        return list(reversed(rows))

    def analytics(self) -> Dict[str, Any]:
        conn = self._conn()
        cur = conn.cursor()
        cur.execute("select kind, count(*) from events group by kind")
        totals = {r[0]: r[1] for r in cur.fetchall()}
        cur.execute("select question, count(*) c from events where kind = 'asked' "
                    "group by question order by c desc limit 12")
        top = [{"q": r[0], "n": r[1]} for r in cur.fetchall()]
        cur.execute("select question, topic, created from events "
                    "where kind in ('unanswered','not_resolved') order by id desc limit 60")
        gaps = [{"q": r[0], "topic": r[1], "t": str(r[2])} for r in cur.fetchall()]
        if not self.pg:
            conn.close()

        asked = totals.get("asked", 0)
        answered = totals.get("answered", 0)
        resolved = totals.get("resolved", 0)
        not_resolved = totals.get("not_resolved", 0)
        handoffs = totals.get("handoff_whatsapp", 0) + totals.get("handoff_ticket", 0)
        rated = resolved + not_resolved
        return {
            "backend": self.kind,
            "totalQuestions": asked,
            "answered": answered,
            "unanswered": totals.get("unanswered", 0),
            "resolutionRate": round(answered / asked * 100) if asked else 0,
            "satisfaction": round(resolved / rated * 100) if rated else 0,
            "handoffRate": round(handoffs / asked * 100) if asked else 0,
            "handoffWhatsapp": totals.get("handoff_whatsapp", 0),
            "handoffTicket": totals.get("handoff_ticket", 0),
            "topQuestions": top,
            "gaps": gaps,
            "raw": totals,
        }


STORE: Optional[Store] = None


# --------------------------------------------------------------------- LLM
def write_answer(question: str, passages: List[Dict[str, Any]]) -> Optional[str]:
    """Let an LLM phrase the answer. Returns None when no key is configured,
    and the caller then serves the retrieved passage verbatim."""
    if not LLM_KEY:
        return None
    context = "\n\n".join("[%s]\n%s" % (p["doc"]["title"], p["doc"]["text"])
                          for p in passages[:3])
    prompt = (
        "You are Treasure, the assistant for Treasure Academy, Ageva, Okene, "
        "Kogi State, a Nigerian primary school. Answer the parent's question "
        "using ONLY the context. Be warm, direct and brief - three sentences "
        "at most. Use Naira for money. If the context does not contain the "
        "answer, reply exactly: INSUFFICIENT\n\n"
        "Context:\n%s\n\nQuestion: %s" % (context, question))
    try:
        import httpx  # type: ignore
        r = httpx.post(
            LLM_URL,
            headers={"Authorization": "Bearer " + LLM_KEY},
            json={"model": LLM_MODEL,
                  "messages": [{"role": "user", "content": prompt}],
                  "temperature": 0.2, "max_tokens": 220},
            timeout=20.0)
        if r.status_code != 200:
            return None
        text = r.json()["choices"][0]["message"]["content"].strip()
        return None if "INSUFFICIENT" in text.upper() else text
    except Exception:
        return None


# ------------------------------------------------------------------ models
class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=600)
    account: str = ""
    session_id: str = ""
    logged_in: bool = False


class FeedbackIn(BaseModel):
    question: str = ""
    topic: str = ""
    helpful: bool
    account: str = ""


class HandoffIn(BaseModel):
    question: str = ""
    channel: str = "ticket"        # "whatsapp" | "ticket"
    account: str = ""


# ------------------------------------------------------------------ routes
@app.on_event("startup")
def startup() -> None:
    global STORE
    RETRIEVER.load()
    STORE = Store()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "retrieval": RETRIEVER.mode,
        "documents": len(RETRIEVER.docs),
        "llm": bool(LLM_KEY),
        "database": STORE.kind if STORE else "none",
    }


@app.post("/ask")
def ask(body: AskIn) -> Dict[str, Any]:
    started = time.time()
    q = body.question.strip()
    hits = RETRIEVER.search(q, 4)
    if STORE:
        STORE.log_event("asked", q, account=body.account)

    if not hits:
        if STORE:
            STORE.log_event("unanswered", q, account=body.account)
        return _handoff_prompt(q, started)

    top = hits[0]
    second = hits[1]["score"] if len(hits) > 1 else 0.0
    confidence = min(1.0, top["score"] * 1.55 + (top["score"] - second) * 0.8)

    if confidence < CONF_BAR:
        if STORE:
            STORE.log_event("unanswered", q, account=body.account, confidence=confidence)
        return _handoff_prompt(q, started)

    doc = top["doc"]
    if doc.get("needs_login") and not body.logged_in:
        if STORE:
            STORE.log_event("login_required", q, doc["title"], body.account, confidence)
        return {
            "type": "needs-login", "title": doc["title"], "url": doc.get("url", ""),
            "answer": ("That information belongs to your own account, so please "
                       "log in and I will take you straight to it."),
            "confidence": round(confidence, 3),
            "ms": int((time.time() - started) * 1000),
        }

    answer = write_answer(q, hits) or doc["text"]
    if STORE:
        STORE.log_event("answered", q, doc["title"], body.account, confidence)
        if body.account and body.session_id:
            STORE.save_message(body.account, body.session_id, "user", q)
            STORE.save_message(body.account, body.session_id, "bot", answer,
                               doc["title"], confidence)
    return {
        "type": "answer",
        "answer": answer,
        "title": doc["title"],
        "url": doc.get("url", ""),
        "confidence": round(confidence, 3),
        "sources": [h["doc"]["title"] for h in hits[:3]],
        "ms": int((time.time() - started) * 1000),
    }


def _handoff_prompt(question: str, started: float) -> Dict[str, Any]:
    return {
        "type": "handoff-ask",
        "answer": ("I could not find a confident answer to that, and I would "
                   "rather not guess. Do you need a reply right now, or can it wait?"),
        "options": [
            {"label": "I need it now", "channel": "whatsapp"},
            {"label": "It can wait", "channel": "ticket"},
        ],
        "confidence": 0.0,
        "ms": int((time.time() - started) * 1000),
    }


@app.post("/feedback")
def feedback(body: FeedbackIn) -> Dict[str, Any]:
    if STORE:
        STORE.log_event("resolved" if body.helpful else "not_resolved",
                        body.question, body.topic, body.account)
    return {"ok": True}


@app.post("/handoff")
def handoff(body: HandoffIn) -> Dict[str, Any]:
    channel = "whatsapp" if body.channel == "whatsapp" else "ticket"
    if STORE:
        STORE.log_event("handoff_" + channel, body.question, account=body.account)
    if channel == "whatsapp":
        return {
            "channel": "whatsapp", "phone": WHATSAPP,
            "url": "https://wa.me/234%s?text=%s" % (
                WHATSAPP.lstrip("0"),
                "Hello Treasure Academy, I need help with: " + body.question),
            "message": "Talk to a person now on WhatsApp " + WHATSAPP,
        }
    return {
        "channel": "ticket", "url": "contact.html",
        "message": ("Use the message form on the Contact page - it reaches the "
                    "school office and the reply comes to you by email."),
    }


@app.get("/history")
def history(account: str = "") -> Dict[str, Any]:
    """Account ids look like TA/2023/001, so they travel as a query parameter.
    As a path segment the slashes split the route and it 404s."""
    if not STORE:
        raise HTTPException(503, "store unavailable")
    if not account:
        raise HTTPException(400, "account required")
    return {"account": account, "messages": STORE.history(account)}


@app.get("/analytics")
def analytics() -> Dict[str, Any]:
    if not STORE:
        raise HTTPException(503, "store unavailable")
    return STORE.analytics()


@app.post("/reindex")
def reindex() -> Dict[str, Any]:
    RETRIEVER.load()
    return {"ok": True, "documents": len(RETRIEVER.docs), "retrieval": RETRIEVER.mode}
