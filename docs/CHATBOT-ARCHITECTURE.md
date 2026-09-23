# Treasure Support AI — architecture

## The constraint that shapes everything

The site is static: Vercel, preset "Other", no build command, no server. A
chatbot that *requires* Python is a chatbot that is switched off in production.

So the system is built in two layers, and the school never sees a dead widget:

    Layer 1  BROWSER RAG        always on, zero infrastructure, works offline
    Layer 2  FastAPI + Postgres optional upgrade: real embeddings, LLM, analytics

Layer 1 is a genuine retrieval pipeline, not a keyword table:

    question -> normalise -> expand (Nigerian English synonyms)
             -> TF-IDF vector -> cosine search over the KB index
             -> best passages -> compose answer -> confidence score

Confidence decides the outcome. Above the bar it answers; below it, it hands
off. That threshold is the whole product.

Layer 2, when TREASURE_AI_URL is configured, replaces the retrieval and the
answer with sentence-transformer embeddings, real vector search and an LLM,
and persists conversations for analytics. The browser falls back the moment
the API is unreachable, so the widget cannot break the site.

## Knowledge base

Built by tools/build-kb.py from the site itself, so it cannot drift:
every public page, plus live school data (fees, exams, transport, uniform,
shop, calendar) and the portal route map. Output: assets/data/kb.json.

## Answers that depend on who is asking

"What are the fees?" is public. "How much do I owe?" is not. Each KB entry
carries needs_login. If the answer needs an account the bot says so and opens
the login popup instead of guessing.

## History

    guest     sessionStorage - dies when the browser tab closes, by design
    logged in localStorage + DB - survives, and on login the guest thread is
              merged in so nothing said before signing in is lost

## Handoff — the part most bots get wrong

When confidence is low the bot does not dump a phone number. It asks one
question first:

    "Do you need an answer right now, or can it wait?"
      right now  -> WhatsApp agent 09063932487 (real-time human)
      can wait   -> contact form ticket (reply by email)

Urgency picks the channel. Both paths return to the chat, so the
conversation continues afterwards.

## Files

    assets/js/chat-rag.js    retrieval: TF-IDF, cosine, confidence
    assets/js/chat-core.js   conversation, live data, history, handoff, analytics
    assets/js/chat-ui.js     the widget
    assets/data/kb.json      generated - do not hand-edit
    tools/build-kb.py        regenerates kb.json from the site
    ai/main.py               optional FastAPI backend
    developer.html           analytics dashboard

## Two sources of truth, on purpose

Static facts come from kb.json. Anything that changes by the hour is read from
the live database at the moment the question is asked: an emergency closure,
whether there is school today, this term's fee for one named class, the next
PTA meeting, the next exam paper, unclaimed lost property, uniform prices and
the admission deadline (resumption + 14 days, which keeps being quoted after
term starts instead of vanishing).

Order matters. A parent who says "my child lost his cardigan" wants the lost
property desk, not the uniform price list, so lost-and-found is checked first.

## After changing site content

    python3 tools/build-kb.py        # rebuild
    node tools/tests/chatbot.test.js # 77 checks

If the FastAPI backend is running, POST /reindex as well.

## Reading the dashboard

Knowledge gaps is the panel that matters: the exact questions that scored
below the confidence bar or were marked unhelpful. Each one is a fact worth
adding to tools/build-kb.py. Rebuild, and the bot answers it next time.

## Deliberate decisions

**It refuses to guess.** Below the confidence bar it hands off. A parent acting
on an invented school fee is worse than a parent who was told to ring.

**Weak matches cannot be talked up.** One stray word ("colour" matching
"Colouring Textbook") used to clear the bar. Any top score under 0.18 is
capped, whatever the rest of the field looks like.

**Courtesy is not a rating.** "Thank you" while feedback is pending is not a
thumbs-up: counting it would flatter the satisfaction figure.

**Urgency picks the channel, not the bot.** Real-time need goes to WhatsApp;
anything that can wait goes to the contact form. The bot asks rather than
assuming.

## Treasure Bot — entity understanding

`assets/js/chat-entities.js` works out **what** a question is about before
anything searches for it. Three maps: things the school holds (with every
synonym a parent might use), class names as people write them, and subjects.
Plus an intent list — lost, employment, partner, enrol, visit, location,
price, timetable, result, contact, compare, safety, food.

This is what separates an assistant from a search box:

    "my child's cardigan is missing"
      -> intent: lost, thing: cardigan
      -> look in the real lost-property records for a cardigan
      -> found:     "Blue cardigan (age 5-6), handed in 2026-09-12"
      -> not found: "No cardigan has been handed in yet. These are the items
                     currently unclaimed: ... Items usually arrive a day or
                     two later, and tell the class teacher."

"sweater", "jumper", "cardi" and "pullover" all reach the same record. The
answer is about **their item**, and when it is not there the bot still gives
the real list and a next step. Never a bare referral.

## The never-dead-end rule

Three layers, in order:

1. **Live data** — emergency notices, today's status, a named class's fee,
   next PTA, next exam, lost property, uniform prices, term dates.
2. **Retrieval** — 53 documents from the site's own pages.
3. **Salvage** (`nearestHelp`) — no confident match, but the question named a
   class or subject, or retrieval was a genuine near miss (>= 0.26). Say
   plainly that it is not written down, give the nearest real fact, offer
   another route.

Only when all three find nothing does it ask the urgency question. Suggesting
"School Hours" to someone asking about swimming lessons is noise, so the
salvage floor is deliberately set above that.

## Visitors who are not parents yet

Employment, partnerships, prospective parents, visits, "why this school",
and safety all have first-class answers, written from what is true on the
site. **Partnerships are answered honestly**: the school publishes no partner
list, so the bot says so and routes to the headmistress rather than inventing
names.

Intent matching is precise about this: "I want to teach at your school" is a
job enquiry; "do you teach French" is not.

## Conversation memory

The clearest way a bot gives itself away is losing the thread:

    "How much is Primary 3?"   ->  Primary 3 is N30,000 per term.
    "and Primary 4?"           ->  (generic Academics page)

`withContext()` fixes that. It remembers what the last substantive question
was *about* - fees, timetable, lost property, results, employment - and when
the next message is only a fragment ("and primary 4?", "what about nursery
2", or a bare "creche?") it carries the topic forward before anything
searches.

Guardrails, because stale context is worse than none:

- Only short messages that open like a continuation, or a bare entity with no
  intent of its own, inherit anything.
- Any message with its own clear intent replaces the topic outright, so
  asking about a lost cardigan after a fee question does not return a price.
- Greetings and courtesy pass through untouched.

The topic lives in memory, not storage: it is conversational state, not
history.

## Suggested questions follow the conversation

The chips change with the topic - after a fee answer they offer paying,
sibling discounts, uniform cost and the deadline. A test asserts the bot can
actually answer **every question it suggests**, because a chip that leads to
"I don't know" is worse than no chip. That test immediately caught "When is
the deadline?" landing in a handoff, and the calendar answer was widened to
cover deadline wording and to degrade gracefully when no calendar has loaded.

## Honesty about what is not fixed

"Sibling discounts may apply - ask the office" is exactly how the admissions
page words it, so that is exactly how the bot words it. It is never stated as
a fixed promise, and a test pins that phrasing.
