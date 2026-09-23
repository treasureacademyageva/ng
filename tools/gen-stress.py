#!/usr/bin/env python3
"""Build the Treasure Bot stress fixture: 10,000 questions.

The method is the one the whole chatbot is built on: the questions here are
NOT the training set - the bot never sees them. They are the EXAM. Every
question is built by taking a fact the school publishes, phrasing it the way
a real person would (parent, new user, guest, teacher, headmistress - logged
in or not), and then roughing it up the way real thumbs do: typos, long-press
accents, symbols between letters, held-down keys, missing spaces, CAPS LOCK,
pidgin, and greetings glued to the front.

Usage:  python3 tools/gen-stress.py
Writes: tools/tests/fixtures-stress-questions.json  (exactly 10,000 entries)

Deterministic: seeded, so the same file is produced every time.
"""
import json
import random
import re

rng = random.Random(20260923)

# --------------------------------------------------------------------------
# Facts the school publishes. Templates use {X}; expects are regexes, ALL of
# which must appear in the answer text (case-insensitive).
# --------------------------------------------------------------------------
CLASSES = [
    ("creche", ["creche", "crèche", "daycare"], "30,000", "Creche"),
    ("pre-nursery", ["pre-nursery", "pre nursery", "playgroup"], "25,000", "Pre-Nursery"),
    ("nursery 1", ["nursery 1", "nursery one", "n1"], "25,000", "Nursery 1"),
    ("nursery 2", ["nursery 2", "nursery two", "n2"], "25,000", "Nursery 2"),
    ("primary 1", ["primary 1", "primary one", "p1"], "30,000", "Primary 1"),
    ("primary 2", ["primary 2", "primary two", "p2"], "30,000", "Primary 2"),
    ("primary 3", ["primary 3", "primary three", "p3"], "30,000", "Primary 3"),
    ("primary 4", ["primary 4", "primary four", "p4"], "35,000", "Primary 4"),
    ("primary 5", ["primary 5", "primary five", "p5"], "35,000", "Primary 5"),
    ("primary 6", ["primary 6", "primary six", "p6"], "35,000", "Primary 6"),
]

FEE_PHRASES = [
    "how much is {X} fees",
    "what is the school fees for {X}",
    "how much are {X} fees",
    "{X} fees",
    "how much do i pay for {X}",
    "how much is {X}",
    "school fees for {X}",
    "wetin be {X} school fees",
    "{X} school fees how much",
    "please how much is {X} fees",
    "i want to know the fees for {X}",
    "what of {X} fees",
    "how much for {X}",
    "the fees for {X} please",
    "{X} fee per term",
]

FACTS = []  # (question, [expects], persona, domain)

for key, names, amount, label in CLASSES:
    for name in names:
        for ph in FEE_PHRASES:
            FACTS.append((ph.replace("{X}", name),
                          [amount, key.split()[0] if "nursery" not in key else key],
                          "parent", "fees"))

FACTS += [
    # fees general / cheapest
    ("how much are the fees", ["30,000", "creche"], "parent", "fees"),
    ("how much is school fees", ["30,000", "creche"], "newuser", "fees"),
    ("what is the total fees", ["30,000", "creche"], "parent", "fees"),
    ("school fees list", ["30,000", "creche"], "parent", "fees"),
    ("list of school fees", ["30,000", "creche"], "parent", "fees"),
    ("fees per term or per year", ["per term"], "parent", "fees"),
    ("what is the cheapest class", ["25,000"], "parent", "fees"),
    ("which class has the lowest fee", ["25,000"], "parent", "fees"),
    ("most affordable class", ["25,000"], "parent", "fees"),
    # transport
    ("how much is transport to adavi", ["5,000", "adavi"], "parent", "transport"),
    ("how much is the bus to adavi", ["5,000", "adavi"], "parent", "transport"),
    ("bus fare to adavi", ["5,000", "adavi"], "parent", "transport"),
    ("transport fee to adavi", ["5,000", "adavi"], "parent", "transport"),
    ("how much is transport to okene", ["6,000", "okene"], "parent", "transport"),
    ("bus fare to okene town", ["6,000", "okene"], "parent", "transport"),
    ("how much is transport to ageva", ["3,000", "ageva"], "parent", "transport"),
    ("bus fare to ageva", ["3,000", "ageva"], "parent", "transport"),
    ("how much is the bus to ageva", ["3,000", "ageva"], "parent", "transport"),
    ("does the school have a bus", ["transport"], "newuser", "transport"),
    ("is there school transport", ["transport"], "newuser", "transport"),
    ("school bus routes", ["route"], "newuser", "transport"),
    # calendar
    ("when does school resume", ["resumption|term|2026"], "parent", "calendar"),
    ("when is resumption", ["resumption|term|2026"], "parent", "calendar"),
    ("when will school start", ["2026"], "parent", "calendar"),
    ("when is independence day", ["1 october 2026"], "parent", "calendar"),
    ("when is mid term break", ["29 october 2026"], "parent", "calendar"),
    ("when is the mid term holiday", ["29 october 2026"], "parent", "calendar"),
    ("when is the carol service", ["18 december 2026"], "parent", "calendar"),
    ("when does the term end", ["18 december 2026"], "parent", "calendar"),
    ("when is closing day", ["18 december 2026"], "parent", "calendar"),
    ("when is the last day of school", ["18 december 2026"], "parent", "calendar"),
    ("when is prize giving day", ["18 december 2026"], "parent", "calendar"),
    ("what events are coming up", ["independence"], "parent", "calendar"),
    ("any events coming up", ["independence"], "parent", "calendar"),
    ("whats happening this term", ["independence"], "parent", "calendar"),
    ("when is the admission deadline", ["deadline"], "parent", "admissions"),
    ("admission deadline", ["deadline"], "newuser", "admissions"),
    ("when is the next exam", ["30 november 2026", "mathematics"], "parent", "exams"),
    ("when is the next test", ["30 november 2026", "mathematics"], "pupil", "exams"),
    ("when do exams start", ["30 november 2026|mathematics|exam"], "parent", "exams"),
    ("exam timetable", ["exam|mathematics"], "parent", "exams"),
    ("when is the next pta meeting", ["4 october 2026", "pta"], "parent", "calendar"),
    ("pta meeting when", ["4 october 2026", "pta"], "parent", "calendar"),
    # hours
    ("what time does school close", ["3:00"], "parent", "hours"),
    ("what time does school open", ["7:00|7:30"], "parent", "hours"),
    ("closing time", ["3:00"], "parent", "hours"),
    ("when does school close", ["3:00"], "parent", "hours"),
    ("are you open on saturday", ["monday to friday"], "parent", "hours"),
    ("do you open on weekends", ["monday to friday"], "parent", "hours"),
    ("office hours", ["7:30", "3:00"], "guest", "hours"),
    # people
    ("who is the headmistress", ["salihu nanahawa"], "guest", "people"),
    ("who is the principal", ["salihu nanahawa"], "guest", "people"),
    ("who leads the school", ["salihu nanahawa"], "guest", "people"),
    ("who is in charge of the school", ["salihu nanahawa"], "guest", "people"),
    ("who founded the school", ["shaibu sidikat ruth"], "guest", "people"),
    ("who owns the school", ["shaibu sidikat ruth"], "guest", "people"),
    ("who started the school", ["shaibu sidikat ruth|2015"], "guest", "people"),
    ("when was the school established", ["2015"], "guest", "people"),
    ("when was the school founded", ["2015"], "guest", "people"),
    ("who teaches primary 3", ["idris ibrahim"], "parent", "people"),
    ("who is the teacher for primary 3", ["idris ibrahim"], "parent", "people"),
    ("who teaches nursery 2", ["siyaka bose"], "parent", "people"),
    ("who teaches primary 5", ["rebeca omeiza"], "parent", "people"),
    ("who teaches primary 6", ["zeenatudeen"], "parent", "people"),
    ("how many teachers do you have", ["teaching staff"], "guest", "people"),
    ("how many teachers are in the school", ["teaching staff"], "guest", "people"),
    # contact / location
    ("what is the school whatsapp number", ["09063932487"], "parent", "contact"),
    ("how do i contact the school", ["09063932487"], "parent", "contact"),
    ("give me the school number", ["09063932487"], "parent", "contact"),
    ("school phone number", ["09063932487"], "guest", "contact"),
    ("where is the school", ["ageva", "okene"], "guest", "contact"),
    ("where is treasure academy located", ["ageva", "okene"], "guest", "contact"),
    ("how do i get to the school", ["ageva|okene"], "guest", "contact"),
    ("school address", ["ageva", "okene"], "guest", "contact"),
    ("can i visit the school", ["visit|welcome"], "newuser", "contact"),
    ("i want to visit the school", ["visit|welcome"], "newuser", "contact"),
    ("can i come and see the school", ["visit|welcome"], "newuser", "contact"),
    # admissions
    ("what are the admission requirements", ["birth certificate"], "newuser", "admissions"),
    ("what do i need for admission", ["birth certificate"], "newuser", "admissions"),
    ("what documents do i bring", ["birth certificate"], "newuser", "admissions"),
    ("how do i register my child", ["admission|register|open"], "newuser", "admissions"),
    ("how can i apply for admission", ["admission|register|open"], "newuser", "admissions"),
    ("i want to register my child", ["admission|register|open"], "newuser", "admissions"),
    ("i want my child to join the school", ["admission|register|open"], "newuser", "admissions"),
    ("are admissions open", ["open"], "newuser", "admissions"),
    ("from what age do you admit children", ["month|age|creche"], "newuser", "admissions"),
    ("how old must a child be for creche", ["month|age|creche"], "newuser", "admissions"),
    ("is the school registered", ["2015", "ageva"], "newuser", "admissions"),
    ("is the school government approved", ["2015", "ageva"], "newuser", "admissions"),
    # uniform / shop
    ("how much is the uniform", ["4,500"], "parent", "uniform"),
    ("uniform price list", ["4,500"], "parent", "uniform"),
    ("what does the uniform cost", ["4,500"], "parent", "uniform"),
    ("how much is the cardigan", ["6,000"], "parent", "uniform"),
    ("how much is sportswear", ["7,500"], "parent", "uniform"),
    ("what do you sell in the shop", ["shop"], "parent", "shop"),
    ("school shop items", ["shop"], "parent", "shop"),
    # elearning / cbt
    ("what is cbt practice", ["common entrance"], "parent", "elearning"),
    ("what is e-learning", ["common entrance"], "parent", "elearning"),
    ("what is elearning", ["common entrance"], "parent", "elearning"),
    ("how does the portal work", ["portal"], "parent", "elearning"),
    ("can primary 6 do common entrance practice", ["common entrance|primary 6"], "parent", "elearning"),
    ("is there online learning", ["common entrance|portal"], "newuser", "elearning"),
    # siblings / accounts
    ("is there a sibling discount", ["sibling|one parent account|same"], "parent", "admissions"),
    ("can i register more than one child", ["one parent account|same|sibling"], "parent", "admissions"),
    ("i have two children", ["one parent account|same|sibling"], "parent", "admissions"),
    ("i forgot my password", ["registration number|password"], "parent", "portal"),
    ("how do i create a password", ["registration number|password"], "parent", "portal"),
    ("my child cannot log in", ["registration number|password"], "parent", "portal"),
    ("how does my child log in", ["registration number|password"], "parent", "portal"),
    # classes / subjects
    ("what classes do you have", ["creche", "primary 6"], "newuser", "academics"),
    ("which classes do you offer", ["creche", "primary 6"], "newuser", "academics"),
    ("what subjects do you teach", ["mathematics|english"], "newuser", "academics"),
    ("do you teach french", ["french"], "newuser", "academics"),
    ("do you teach computer", ["computer"], "newuser", "academics"),
    ("is there a computer room", ["computer room"], "newuser", "academics"),
    ("tell me about primary 3", ["primary 3"], "newuser", "academics"),
    ("what happens in primary 1", ["primary 1"], "newuser", "academics"),
    ("tell me about nursery 2", ["nursery 2"], "newuser", "academics"),
    ("what is primary 6 like", ["primary 6"], "newuser", "academics"),
    ("what happens after primary 6", ["primary 6|common entrance"], "parent", "academics"),
    ("tell me about the alumni", ["2024|common entrance"], "parent", "academics"),
    ("old students of the school", ["alumni|2024"], "parent", "academics"),
    # mission / facilities / safety / food
    ("what is the school mission", ["mission|future leader"], "guest", "about"),
    ("what is the school motto", ["motto|mission|vision"], "guest", "about"),
    ("what facilities do you have", ["library|computer|playground"], "newuser", "about"),
    ("do you have a library", ["library"], "newuser", "about"),
    ("is there a playground", ["playground|facilit"], "newuser", "about"),
    ("how safe is the school", ["supervised|gate"], "newuser", "about"),
    ("is my child safe at school", ["supervised|gate"], "newuser", "about"),
    ("can my child eat at school", ["meal"], "parent", "about"),
    ("do you serve food", ["meal"], "parent", "about"),
    ("what about bullying", ["supervised|office|09063932487"], "parent", "about"),
    # lost property
    ("my child lost his cardigan", ["cardigan"], "parent", "lost"),
    ("i lost my child sweater", ["cardigan"], "parent", "lost"),
    ("my daughter lost her water bottle", ["bottle|office"], "parent", "lost"),
    ("anything in lost and found", ["cardigan|office|unclaimed"], "parent", "lost"),
    # results / reports
    ("how do i check my child result", ["result|portal|log"], "parent", "results"),
    ("when will results be out", ["result"], "parent", "results"),
    ("how do i get my child report card", ["report|result|portal"], "parent", "results"),
    ("show me my results", ["result|portal|log"], "parentlogin", "results"),
    ("my child results", ["result|portal|log"], "parentlogin", "results"),
    ("my fees balance", ["fee|portal|log"], "parentlogin", "results"),
    # handoff
    ("i need to talk to someone", ["09063932487"], "parent", "contact"),
    ("can i chat with a human", ["09063932487"], "parent", "contact"),
    ("i want to speak to a person", ["09063932487"], "parent", "contact"),
    ("talk to someone", ["09063932487"], "parent", "contact"),
]

TEACHER_QS = [
    ("how do i mark the register", ["teacher portal"]),
    ("where do i mark the register", ["teacher portal"]),
    ("how do i enter results", ["teacher portal"]),
    ("where do i enter results", ["teacher portal"]),
    ("how do i submit scores", ["teacher portal"]),
    ("how do i see the duty roster", ["teacher portal"]),
    ("where do i see notices", ["teacher portal"]),
    ("how do i see my class fees", ["teacher portal", "fee"]),
    ("staff chat how does it work", ["teacher portal"]),
    ("how do i use staff chat", ["teacher portal"]),
]

HEAD_QS = [
    ("how do i approve a pupil", ["admin console"]),
    ("how do i verify a parent", ["admin console"]),
    ("how do i verify a registration", ["admin console"]),
    ("how do i set the fees", ["admin console"]),
    ("how do i set new fees", ["admin console"]),
    ("how do i send a notification", ["admin console"]),
    ("how do i broadcast a notice", ["admin console"]),
    ("how do i post an event", ["admin console"]),
    ("verification queue where is it", ["admin console"]),
    ("how do i chat with the headmistress", ["09063932487"]),
]

SALVAGE_QS = [
    ("is mathematics compulsory", ["mathematics is taught"]),
    ("when is sports day", ["do not have that written down|when"]),
    ("when is interhouse sports", ["do not have that written down|when"]),
    ("can my child bring a phone to school", ["09063932487"]),
    ("who is the bursar", ["bursary|fee"]),
    ("is there a scholarship", ["scholarship|bursary|fee"]),
    ("does primary 5 do excursions", ["primary 5"]),
    ("when is open day", ["visit|open|do not have"]),
    ("where do i buy the uniform", ["office|uniform"]),
    ("do you have a swimming pool", ["pool|facilit"]),
]

REFUSE_QS = [
    "who won the world cup",
    "what is the capital of france",
    "what is the capital of japan",
    "sell me a car",
    "how do i bake bread",
    "who is the president of nigeria",
    "who is the president of america",
    "best footballer in the world",
    "what is bitcoin",
    "when did the titanic sink",
    "who wrote macbeth",
    "tell me a joke",
    "recite the alphabet backwards",
    "what is the weather tomorrow",
    "translate good morning to french",
    "who is the richest man in nigeria",
    "what is the meaning of life",
    "how tall is mount kilimanjaro",
    "what is 2 plus 2",
    "best movie this year",
    "who scored for chelsea",
    "how many planets are there",
    "who discovered america",
    "how can i slim down",
    "how many bones are in the body",
    "teach me how to dance",
    "write me a poem about rain",
]

IDENTITY_QS = [
    "who are you", "what are you", "whats your name", "what is your name",
    "who am i talking to", "who is this", "what can you do",
    "what can you do for me", "what can you help me with",
    "how can you help me", "whats your purpose", "what is your purpose",
    "what do you do", "what do you know", "are you a bot",
    "are you a robot", "are you human", "are you chatgpt", "are you real",
    "are you a person", "who made you", "who created you",
    "who built you", "who trained you", "help", "menu", "options",
    "what are you here for",
]

GREET_BASE = [
    "hello", "hi", "hey", "hiya", "yo", "howdy", "greetings",
    "good morning", "good afternoon", "good evening", "good day",
    "whats up", "wassup", "sup", "whats popping", "whats cracking",
    "whats capping", "whats good", "how are you", "how are you doing",
    "how are you today", "hows it going", "how you doing", "hope you are fine",
    "hope all is well", "how do you do", "how are things",
    "how far", "how now", "how body", "how you dey", "wetin dey happen",
    "sannu", "sannu da zuwa", "barka da zuwa", "ina kwana",
    "e kaaro", "e kaasan", "e kaale", "bawo ni", "pele o",
    "kedu", "kedu ka i mere", "ndewo", "nnoo",
    "salam", "salaam", "salam alaikum", "assalamu alaikum", "marhaba",
    "bonjour", "bonsoir", "salut", "hola", "buenos dias",
    "hallo", "guten tag", "ciao", "buongiorno", "bom dia", "ola",
    "jambo", "habari", "merhaba", "selam", "namaste", "namaskar",
    "konnichiwa", "ohayo", "ni hao", "nihao", "shalom",
]

THANKS_BASE = [
    "thank you", "thanks", "thank u", "thanks a lot", "much appreciated",
    "nice one", "well done", "good job", "na gode", "e se", "imela",
    "merci", "gracias", "danke", "obrigado", "shukran", "grazie", "asante",
]

BYE_BASE = [
    "bye", "goodbye", "good bye", "see you", "see ya", "catch you later",
    "later", "take care", "good night", "o dabo", "au revoir", "adios",
    "sayonara", "kwaheri",
]

SMALLTALK_BASE = [
    "ok", "okay", "yes", "no", "yeah", "nope", "it can wait",
    "i need it now", "now", "anytime",
]

CONTEXT_TRIPLES = [
    ("how much is primary 3 fees", ["and primary 4?", "what about primary 4?",
     "what of primary 4?", "how about primary 4?", "and p4?", "also primary 4?"], "35,000"),
    ("how much is primary 3 fees", ["and primary 6?", "what about primary 6?",
     "what of p6?", "how about primary six?"], "35,000"),
    ("how much is nursery 1 fees", ["and primary 1?", "what about primary 1?",
     "what of primary one?"], "30,000"),
    ("who teaches primary 3", ["what about primary 5?", "and primary 5?",
     "what of primary 5?", "how about p5?"], "rebeca omeiza|primary 5"),
    ("who is the headmistress", ["and the founder?", "what about the founder?",
     "who founded it?"], "shaibu sidikat ruth"),
    ("how much is transport to adavi", ["and to okene?", "what about okene?",
     "what of okene town?"], "6,000"),
    ("when is the next exam", ["and the pta meeting?", "what about the pta meeting?",
     "what of the pta?"], "pta"),
    ("when is the next staff birthday", ["and aunty rafatu?", "what about aunty rafatu?",
     "what of rafatu?"], "21 june"),
]

LOGGEDIN_QS = [
    ("hello", ["treasure bot"], "greet"),
    ("hi", ["treasure bot"], "greet"),
    ("good morning", ["treasure bot"], "greet"),
    ("who are you", ["treasure bot"], "identity"),
    ("what can you do for me", ["treasure bot"], "identity"),
    ("show me my results", ["result"], "fact"),
    ("my results", ["result"], "fact"),
    ("my child results", ["result"], "fact"),
    ("my fees balance", ["fee"], "fact"),
    ("how much is primary 3 fees", ["30,000"], "fact"),
    ("when is the next exam", ["30 november 2026"], "fact"),
]

# --------------------------------------------------------------------------
# Perturbations: how real typing goes wrong. Each takes a question and the
# seeded RNG, and returns a roughened question.
# --------------------------------------------------------------------------
ACCENTS = list("éèêëïíüöçàùâîôñ")

def word_at(q, minlen, pred=None):
    words = [(m.start(), m.group()) for m in re.finditer(r"[a-z]+", q)]
    ok = [w for w in words if len(w[1]) >= minlen and (pred is None or pred(w[1]))]
    return rng.choice(ok) if ok else None

def p_swap(q):
    w = word_at(q, 5)
    if not w:
        return q
    i, t = w
    j = rng.randrange(len(t) - 1)
    if t[j] == t[j + 1]:
        return q
    t2 = t[:j] + t[j + 1] + t[j] + t[j + 2:]
    return q[:i] + t2 + q[i + len(t):]

def p_drop(q):
    w = word_at(q, 5)
    if not w:
        return q
    i, t = w
    j = rng.randrange(len(t))
    return q[:i] + t[:j] + t[j + 1:] + q[i + len(t):]

def p_double(q):
    w = word_at(q, 5)
    if not w:
        return q
    i, t = w
    j = rng.randrange(len(t))
    return q[:i] + t[:j] + t[j] * 2 + t[j:] + q[i + len(t):]

def p_accent(q):
    w = word_at(q, 5)
    if not w:
        return q
    i, t = w
    j = rng.randrange(len(t))
    return q[:i] + t[:j] + rng.choice(ACCENTS) + t[j + 1:] + q[i + len(t):]

def p_symbol(q):
    w = word_at(q, 5)
    if not w:
        return q
    i, t = w
    j = rng.randrange(1, len(t))
    return q[:i] + t[:j] + rng.choice("$£€#*") + t[j:] + q[i + len(t):]

def p_repeat(q):
    w = word_at(q, 4)
    if not w:
        return q
    i, t = w
    j = rng.randrange(len(t))
    return q[:i] + t[:j] + t[j] * rng.choice((3, 4)) + t[j + 1:] + q[i + len(t):]

def p_join(q):
    pairs = [(m.start(), m.end()) for m in re.finditer(r"[a-z]{3,} [a-z]{3,}", q)]
    if not pairs:
        return q
    i, j = rng.choice(pairs)
    return q[:i] + q[i:j].replace(" ", "", 1) + q[j:]

def p_caps(q):
    return q.upper()

def p_exclaim(q):
    return q.rstrip("!.? ") + rng.choice(("!!!", "???", "?!", " please!!!", " abeg"))

def p_greet_prefix(q):
    return rng.choice(("hello ", "hi ", "hey ", "good morning, ", "good afternoon ",
                       "hello, ", "sannu, ", "assalam alaikum, ", "hi there, ")) + q

def p_polite(q):
    return rng.choice(("please ", "excuse me ", "kindly ", "please i beg, ")) + q

PIDGIN_MAP = [
    ("what is", "wetin be"), ("how much is", "how much be"),
    ("my child", "my pikin"), ("i want to know", "i wan know"),
    ("i want to", "i wan"), ("do you have", "you get"),
    ("please", "abeg"), ("the school", "the school"),
]

def p_pidgin(q):
    for a, b in PIDGIN_MAP:
        if a in q and rng.random() < 0.8:
            q = q.replace(a, b, 1)
    return q

def p_leet(q):
    w = word_at(q, 5, pred=lambda t: any(c in t for c in "oae"))
    if not w:
        return q
    i, t = w
    t2 = t
    for src, dst in (("o", "0"), ("a", "4"), ("e", "3")):
        if src in t2:
            t2 = t2.replace(src, dst, 1)
            break
    return q[:i] + t2 + q[i + len(t):]

PERTURBATIONS = [
    p_swap, p_drop, p_double, p_accent, p_symbol, p_repeat, p_join,
    p_caps, p_exclaim, p_greet_prefix, p_polite, p_pidgin, p_leet,
]

def combo(q):
    f = rng.choice((p_swap, p_drop, p_accent, p_symbol, p_double))
    g = rng.choice((p_exclaim, p_greet_prefix, p_polite, p_caps))
    return g(f(q))

# --------------------------------------------------------------------------
# Pool builders - each yields (q, expects, cls, persona, domain) dicts.
# --------------------------------------------------------------------------
out = []

def emit(q, expects, cls, persona, domain, pre=None):
    e = {"q": q, "cls": cls, "persona": persona, "domain": domain}
    if isinstance(expects, str):
        expects = [expects]
    if expects:
        e["expect"] = expects
    if pre:
        e["pre"] = pre
    out.append(e)

# ---- fact pool: 6,900 ------------------------------------------------------
FACT_TARGET = 6900
i = 0
mods = PERTURBATIONS + [combo, None]
while len(out) < FACT_TARGET:
    q, expects, persona, domain = FACTS[i % len(FACTS)]
    mod = mods[(i // len(FACTS)) % len(mods)]
    q2 = mod(q) if mod else q
    emit(q2, expects, "fact", persona, domain)
    i += 1

# ---- greet pool: 700 -------------------------------------------------------
GREET_TARGET = 700
greet_variants = [lambda g: g, lambda g: g + "!", lambda g: g + "?",
                  lambda g: g.upper(), lambda g: g + " there",
                  lambda g: g + " sir", lambda g: g + " ma",
                  lambda g: g + " oo", lambda g: g + " everyone",
                  lambda g: "good day, " + g]
i = 0
while sum(1 for e in out if e["cls"] == "greet") < GREET_TARGET:
    g = GREET_BASE[i % len(GREET_BASE)]
    v = greet_variants[(i // len(GREET_BASE)) % len(greet_variants)](g)
    emit(v, None, "greet", "guest", "smalltalk")
    i += 1

# ---- thanks: 150 / bye: 100 / smalltalk: 120 -------------------------------
for base, cls, n in ((THANKS_BASE, "thanks", 150), (BYE_BASE, "bye", 100),
                     (SMALLTALK_BASE, "smalltalk", 120)):
    i = 0
    while sum(1 for e in out if e["cls"] == cls) < n:
        q = base[i % len(base)]
        if i // len(base) == 1:
            q = q.upper()
        elif i // len(base) == 2:
            q = p_accent(q) if cls not in ("smalltalk",) else q
        emit(q, None, cls, "guest", "smalltalk")
        i += 1

# ---- identity: 450 ---------------------------------------------------------
IDENT_TARGET = 450
i = 0
while sum(1 for e in out if e["cls"] == "identity") < IDENT_TARGET:
    q = IDENTITY_QS[i % len(IDENTITY_QS)]
    mod = mods[(i // len(IDENTITY_QS)) % len(mods)]
    q2 = mod(q) if mod else q
    emit(q2, ["treasure bot"], "identity", "guest", "identity")
    i += 1

# ---- portal: teacher 200 / headmistress 200 --------------------------------
for base, persona, n, domain in ((TEACHER_QS, "teacher", 200, "portal"),
                                 (HEAD_QS, "headmistress", 200, "portal")):
    i = 0
    while sum(1 for e in out if e["persona"] == persona) < n:
        q, expects = base[i % len(base)]
        mod = mods[(i // len(base)) % len(mods)]
        q2 = mod(q) if mod else q
        emit(q2, expects, "portal", persona, domain)
        i += 1

# ---- salvage: 250 ----------------------------------------------------------
i = 0
while sum(1 for e in out if e["cls"] == "salvage") < 250:
    q, expects = SALVAGE_QS[i % len(SALVAGE_QS)]
    mod = mods[(i // len(SALVAGE_QS)) % len(mods)]
    q2 = mod(q) if mod else q
    emit(q2, expects, "salvage", "parent", "salvage")
    i += 1

# ---- refuse: 350 -----------------------------------------------------------
i = 0
refuse_variants = [lambda q: q, lambda q: q.upper(), lambda q: q + "??",
                   lambda q: q + " please", p_swap, p_accent, p_caps]
while sum(1 for e in out if e["cls"] == "refuse") < 350:
    q = REFUSE_QS[i % len(REFUSE_QS)]
    v = refuse_variants[(i // len(REFUSE_QS)) % len(refuse_variants)](q)
    emit(v, None, "refuse", "guest", "offtopic")
    i += 1

# ---- context: 300 ----------------------------------------------------------
i = 0
ctx_all = []
for pre, frags, expect in CONTEXT_TRIPLES:
    for frag in frags:
        ctx_all.append((pre, frag, expect))
while sum(1 for e in out if e["cls"] == "context") < 300:
    pre, frag, expect = ctx_all[i % len(ctx_all)]
    mod = [None, p_greet_prefix, p_polite, p_accent, p_swap, p_exclaim][(i // len(ctx_all)) % 6]
    frag2 = mod(frag) if mod else frag
    emit(frag2, [expect], "context", "parent", "context", pre=pre)
    i += 1

# ---- logged-in parent: 280 -------------------------------------------------
i = 0
while sum(1 for e in out if e["persona"] == "parentlogin") < 280:
    q, expects, cls = LOGGEDIN_QS[i % len(LOGGEDIN_QS)]
    mod = [None, p_greet_prefix, p_polite, p_caps, p_accent][(i // len(LOGGEDIN_QS)) % 5]
    q2 = mod(q) if mod else q
    emit(q2, expects, cls if cls != "greet" else "greet", "parentlogin",
         "session")
    i += 1

# ---- pad to exactly 10,000 with fact variants ------------------------------
PAD_CLASSES = ["fees", "calendar", "admissions", "contact", "academics"]
j = 0
while len(out) < 10000:
    q, expects, persona, domain = FACTS[j % len(FACTS)]
    mod = PERTURBATIONS[(j * 7) % len(PERTURBATIONS)]
    emit(mod(q), expects, "fact", persona, domain)
    j += 1
assert len(out) == 10000, len(out)

# deterministic shuffle
rng.shuffle(out)

with open("tools/tests/fixtures-stress-questions.json", "w") as f:
    json.dump(out, f, ensure_ascii=True, separators=(",", ":"))

from collections import Counter
print("wrote", len(out), "questions")
print(Counter(e["cls"] for e in out).most_common())
print(Counter(e["persona"] for e in out).most_common())
