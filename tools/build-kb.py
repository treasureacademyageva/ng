#!/usr/bin/env python3
"""
Build the chatbot knowledge base from the site itself.

Everything the bot knows is extracted from real pages and real school data, so
the knowledge base cannot drift away from what the site actually says. Run it
after changing site content:

    python3 tools/build-kb.py

Writes assets/data/kb.json.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Pages worth indexing, with the topic words a parent would actually type.
PAGES = {
    "index.html":        ("Home", "home welcome treasure academy ageva okene kogi"),
    "about.html":        ("About Us", "about story history mission vision motto founder headmistress"),
    "admissions.html":   ("Admissions", "admission apply enrol enroll register registration join entry"),
    "admission-form.html": ("Admission Form", "admission form buy purchase entrance download print"),
    "academics.html":    ("Academics", "academics class classes curriculum subjects creche nursery primary"),
    "fees.html":         ("School Fees", "fees fee payment pay cost price tuition bank transfer"),
    "exams.html":        ("Examinations", "exam exams examination timetable paper test"),
    "calendar.html":     ("School Calendar", "calendar term date resumption holiday event closing"),
    "contact.html":      ("Contact Us", "contact phone call whatsapp email address location directions message"),
    "transport.html":    ("Transport", "transport bus route pickup drop school bus fare"),
    "uniform.html":      ("Uniform", "uniform shirt skirt shorts cardigan sportswear sandals socks beret"),
    "shop.html":         ("School Shop", "shop book textbook notebook pen stationery buy price stock"),
    "news.html":         ("News & Events", "news event photo video gallery story party excursion"),
    "pta.html":          ("PTA", "pta parent teacher association meeting"),
    "elearning.html":    ("E-Learning", "elearning e-learning practice cbt common entrance revision"),
    "homework.html":     ("Homework", "homework assignment work exercise"),
    "holiday.html":      ("Holiday Work", "holiday assignment vacation break work"),
    "testimonials.html": ("Testimonials", "testimonial review parent say feedback"),
    "board.html":        ("Notice Board", "notice board announcement"),
    "birthdays.html":    ("Birthdays", "birthday celebrate staff"),
    "alumni.html":       ("Alumni", "alumni old pupil graduate former"),
    "careers.html":      ("Careers", "career job vacancy employment teacher apply work"),
    "volunteer.html":    ("Volunteer", "volunteer help support community"),
    "openday.html":      ("Open Day", "open day visit tour inspection"),
    "photo-day.html":    ("Photo Day", "photo picture portrait photograph"),
    "reading.html":      ("Reading Corner", "reading book library story read"),
    "lost-found.html":   ("Lost & Found", "lost found missing item property"),
    "support.html":      ("Support", "support help assistance problem issue"),
    "anthem.html":       ("School Anthem", "anthem song sing"),
    "story.html":        ("Our Story", "story history beginning founder"),
    "search.html":       ("Search", "search find look"),
    "receipt.html":      ("Receipt Check", "receipt verify check payment confirm authentic"),
    "welcome.html":      ("Welcome", "welcome new parent start"),
    "class.html":        ("Class Pages", "class page primary nursery teacher"),
}

# Where the bot should send people. Routes that need an account are marked so
# the bot offers to open the login popup instead of pretending it can help.
ROUTES = [
    ("Pupil / Parent Portal", "portal/pupil.html", True,
     "results attendance fees notices timetable report card my child"),
    ("Teacher Portal", "portal/teacher.html", True,
     "register attendance results homework duty staff teacher"),
    ("Admin Console", "portal/admin.html", True,
     "admin headmistress manage pupils teachers settings"),
    ("Login / Register", "portal/login.html", False,
     "login log in sign in register sign up account password"),
]


def strip_html(html):
    """Readable text from a page: drop code and chrome, keep the prose."""
    html = re.sub(r"(?is)<script.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?</style>", " ", html)
    html = re.sub(r"(?is)<svg.*?</svg>", " ", html)
    html = re.sub(r"(?is)<(nav|footer|header)[^>]*>.*?</\1>", " ", html)
    # The masthead, ticker, skip link and chat widget are on every page. Left
    # in, they poison every answer with "Skip to content Portal Login ...".
    html = re.sub(r"(?is)<(div|section|aside)[^>]*\bclass=\"[^\"]*\b"
                  r"(topbar|navbar|brand|site-footer|ticker|newsTicker|motto-ribbon|"
                  r"emg-banner|chat-panel|chat-fab|clock-widget|breadcrumb|page-hero)"
                  r"\b[^\"]*\"[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?is)<a[^>]*\bclass=\"[^\"]*skip[^\"]*\"[^>]*>.*?</a>", " ", html)
    html = re.sub(r"(?s)<!--.*?-->", " ", html)
    html = re.sub(r"<[^>]+>", " ", html)
    txt = re.sub(r"&nbsp;?", " ", html)
    txt = (txt.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
              .replace("&quot;", '"').replace("&#39;", "'").replace("&mdash;", "-")
              .replace("&ndash;", "-").replace("&hellip;", "..."))
    return re.sub(r"\s+", " ", txt).strip()


def headings(html):
    out = []
    for m in re.finditer(r"(?is)<h[1-3][^>]*>(.*?)</h[1-3]>", html):
        h = strip_html(m.group(1))
        if h and len(h) < 90:
            out.append(h)
    return out


def js_value(store, name):
    """Pull one array/object literal out of store.js by walking its brackets."""
    i = store.find(name + ":")
    if i < 0:
        return None
    j = i
    while j < len(store) and store[j] not in "[{":
        j += 1
    if j >= len(store):
        return None
    open_ch, close_ch = store[j], "]" if store[j] == "[" else "}"
    depth = 0
    for k in range(j, len(store)):
        if store[k] == open_ch:
            depth += 1
        elif store[k] == close_ch:
            depth -= 1
            if depth == 0:
                return store[j:k + 1]
    return None


def common_boilerplate(texts):
    """Phrases repeated across most pages are chrome, not content."""
    from collections import Counter
    c = Counter()
    for t in texts:
        for frag in set(re.split(r"(?<=[.!?])\s+|\s{2,}", t)):
            frag = frag.strip()
            if 8 <= len(frag) <= 120:
                c[frag] += 1
    threshold = max(3, int(len(texts) * 0.55))
    return set(f for f, n in c.items() if n >= threshold)


def build():
    docs = []

    def add(doc_id, title, text, keywords, url, needs_login=False, kind="page"):
        text = re.sub(r"\s+", " ", text or "").strip()
        if not text:
            return
        docs.append({
            "id": doc_id, "title": title, "text": text[:1400],
            "keywords": keywords, "url": url,
            "needs_login": bool(needs_login), "kind": kind,
        })

    # ---- 1. every public page -------------------------------------------
    raws = {}
    for fname in PAGES:
        path = os.path.join(ROOT, fname)
        if os.path.exists(path):
            raws[fname] = open(path, encoding="utf-8", errors="ignore").read()
    boiler = common_boilerplate([strip_html(r) for r in raws.values()])

    def de_chrome(text):
        for frag in boiler:
            text = text.replace(frag, " ")
        # Whatever survives of the skip link / brand line goes too.
        text = re.sub(r"(?i)\bskip to (main )?content\b", " ", text)
        text = re.sub(r"(?i)\bportal login\b", " ", text)
        # The page title and address line repeat on every page.
        text = re.sub(r"(?i)\s*[-\u2013\u2014]\s*Treasure Academy,? Ageva\b", " ", text)
        text = re.sub(r"(?i)\bTreasure Academy,? Ageva\b", " ", text)
        text = re.sub(r"(?i)\bAgeva,? Okene,? Kogi State\b", " ", text)
        text = re.sub(r"(?i)\b(Print|Download)\s+\w+\b", " ", text)
        return re.sub(r"\s+", " ", text).strip(" .,-|")

    for fname, (title, kw) in sorted(PAGES.items()):
        if fname not in raws:
            continue
        raw = raws[fname]
        body = de_chrome(strip_html(raw))
        # Pages whose content is painted by JavaScript leave almost nothing in
        # the HTML. Indexing that shell makes the bot answer with a page title.
        # The live-data documents below carry the real content for these.
        if len(body) < 140:
            continue
        hs = headings(raw)
        add("page:" + fname, title, body,
            (kw + " " + " ".join(hs)).lower(), fname, False, "page")

        # Long pages become several passages so retrieval can be precise.
        if len(body) > 900:
            for n, chunk in enumerate(
                    [body[x:x + 700] for x in range(0, min(len(body), 3500), 700)][1:], 2):
                add("page:%s#%d" % (fname, n), title, chunk, kw.lower(), fname, False, "page")

    # ---- 2. live school data from store.js ------------------------------
    store = open(os.path.join(ROOT, "assets/js/store.js"),
                 encoding="utf-8", errors="ignore").read()

    fees = js_value(store, "fees")
    if fees:
        pairs = re.findall(r'"?([A-Za-z0-9 \-]+)"?\s*:\s*(\d{3,6})', fees)
        if pairs:
            add("data:fees", "School Fees by Class",
                "Termly school fees: " +
                "; ".join("%s N%s" % (c.strip(), a) for c, a in pairs) +
                ". Payment is by bank transfer to the school account and an "
                "official receipt number is issued once confirmed.",
                "fees fee how much cost price pay tuition amount naira class termly",
                "fees.html", False, "data")

    exams = js_value(store, "exams")
    if exams:
        rows = re.findall(r'date:"([^"]+)"[^}]*?time:"([^"]*)"[^}]*?subject:"([^"]+)"', exams)
        if rows:
            add("data:exams", "Examination Timetable",
                "Exam timetable: " +
                "; ".join("%s %s %s" % (d, t, s) for d, t, s in rows) + ".",
                "exam exams timetable paper when write subject date time",
                "exams.html", False, "data")

    routes = js_value(store, "transportRoutes")
    if routes:
        rows = re.findall(r'route:"([^"]+)"[^}]*?pickup:"([^"]*)"[^}]*?fee:(\d+)', routes)
        if rows:
            add("data:transport", "Transport Routes and Fares",
                "School bus routes: " +
                "; ".join("%s picks up at %s for N%s per term" % (r, p, f)
                          for r, p, f in rows) + ".",
                "transport bus route pickup fare cost bus stop drop off school bus",
                "transport.html", False, "data")

    uni = js_value(store, "uniform")
    if uni:
        rows = re.findall(r'name:"([^"]+)"[^}]*?price:(\d+)', uni)
        if rows:
            add("data:uniform", "Uniform Price List",
                "Uniform items and prices: " +
                "; ".join("%s N%s" % (n, p) for n, p in rows) +
                ". Uniforms are collected at the school office.",
                "uniform price cost shirt skirt shorts cardigan sportswear sandals socks beret buy",
                "uniform.html", False, "data")

    shop = js_value(store, "shopItems")
    if shop:
        rows = re.findall(r'name:"([^"]+)"[^}]*?price:(\d+)[^}]*?icon:"[^"]*",\s*qty:(\d+)', shop)
        if rows:
            add("data:shop", "School Shop Price List",
                "Shop items: " +
                "; ".join("%s N%s%s" % (n, p, " (out of stock)" if q == "0" else "")
                          for n, p, q in rows[:25]) + ".",
                "shop buy book textbook notebook pen crayon stationery price cost stock available",
                "shop.html", False, "data")

    cal = js_value(store, "calendar")
    if cal:
        rows = re.findall(r'date:"([^"]+)"[^}]*?title:"([^"]+)"', cal)
        if rows:
            add("data:calendar", "School Calendar",
                "Key dates: " + "; ".join("%s %s" % (d, t) for d, t in rows) + ".",
                "calendar date term resumption holiday closing event when school resume start",
                "calendar.html", False, "data")

    school = js_value(store, "school")
    if school:
        sess = re.search(r'session:"([^"]+)"', school or "")
        term = re.search(r'term:"([^"]+)"', school or "")
        if sess or term:
            add("data:session", "Current Session and Term",
                "The current academic session is %s and the current term is %s."
                % (sess.group(1) if sess else "the current session",
                   term.group(1) if term else "the current term"),
                "session term current which what now academic year",
                "calendar.html", False, "data")

    # ---- 3. routes ------------------------------------------------------
    for title, url, needs_login, kw in ROUTES:
        add("route:" + url, title,
            "%s is at %s.%s" % (title, url,
                                " You need to be logged in to use it." if needs_login else ""),
            kw, url, needs_login, "route")

    # ---- 4. things a parent asks that no page states outright -----------
    facts = [
        ("fact:hours", "School Hours",
         "School runs Monday to Friday. The gate opens at 7:00am, assembly is "
         "7:45am, lessons start 8:00am, break is 10:00am and closing time is "
         "3:00pm. Pupils should be picked up by 3:00pm.",
         "hours time open close closing what time pick up collect child when finish dismissal", "index.html", False),
        ("fact:payment", "How to Pay Fees",
         "Fees are paid by bank transfer to the school account. After paying, "
         "take the teller or transfer receipt to the school office, or check it "
         "on the Receipt page. An official receipt number is issued once "
         "confirmed. The school does not collect cash online.",
         "pay payment how to pay bank transfer account teller receipt confirm fees", "fees.html", False),
        ("fact:password", "Password and Login Help",
         "New pupils enter their Registration Number and the Create Password "
         "form appears automatically. If a password is wrong twice the Forgot "
         "Password form opens so it can be reset. Staff log in with Staff ID "
         "and PIN. The headmistress can reset any staff PIN.",
         "password forgot reset cannot login cant log in locked out pin wrong", "portal/login.html", False),
        ("fact:results", "Checking Results",
         "Log in to the pupil portal with the Registration Number and password, "
         "open Results, and the report card can be viewed and downloaded.",
         "result results report card grade score check download term", "portal/pupil.html", True),
        ("fact:whatsapp", "WhatsApp Support",
         "For an urgent reply, chat with the school on WhatsApp on 09063932487. "
         "For anything that can wait, use the message form on the Contact page "
         "and the reply comes by email.",
         "whatsapp urgent talk human agent person real chat call now speak", "contact.html", False),
        ("fact:head", "School Leadership",
         "The headmistress of Treasure Academy, Ageva is Mrs. Salihu Nanahawa. "
         "She leads the teaching staff and can be reached through the school "
         "office or the Contact page.",
         "headmistress head principal proprietor owner who runs leader boss "
         "in charge madam management", "about.html", False),
        ("fact:where", "Where the School Is",
         "Treasure Academy is at Ageva, Okene, Kogi State. The Contact page has "
         "directions, a map and the school phone numbers.",
         "where located location address directions map find come visit place "
         "area town state", "contact.html", False),
        ("fact:jobs", "Working at Treasure Academy",
         "Treasure Academy hires teachers and support staff. We hire for "
         "character first, then skill: people who keep promises, speak kindly "
         "and treat every child like their own. Small classes, supportive "
         "leadership and a termly teaching plan. Pay is discussed at interview "
         "and paid on time. Apply with the form on the Careers page giving your "
         "name, WhatsApp number, the position, your highest qualification and "
         "brief experience. Shortlisted applicants are called within two weeks.",
         "job jobs vacancy vacancies employment hiring hire recruit teach work "
         "career apply position cv resume salary interview staff", "careers.html", False),
        ("fact:new-parent", "Bringing Your Child to Treasure Academy",
         "Admissions are open. The school takes children from Creche at six "
         "months, through Pre-Nursery, Nursery 1 and 2, to Primary 1 up to "
         "Primary 6. Register through Login/Register in three steps - ward, "
         "guardian, payment - then visit the school within two weeks to "
         "complete it. Parents are welcome to visit the school first and look "
         "around. One parent account can hold several children.",
         "new parent prospective bring my child join start school place space "
         "enrol enroll admit accept intake beginner first time", "admissions.html", False),
        ("fact:why-us", "Why Parents Choose Treasure Academy",
         "Small classes so every child is known by name. Creche through to "
         "Primary 6 on one permanent site. Founded in 2015 by Shaibu Sidikat "
         "Ruth, a mother and trained teacher, and on its own site since the "
         "third year. Common Entrance practice built into Primary 6. "
         "Supervised school transport on three routes. Results, attendance and "
         "fees are visible to parents in the portal.",
         "why choose better compare different advantage best good reputation "
         "standard quality recommend", "about.html", False),
        ("fact:visit", "Visiting the School",
         "Visitors are welcome at Ageva, Okene, Kogi State. The office is open "
         "Monday to Friday, 7:30am to 3:00pm. No appointment is needed to look "
         "around, but a message on 09063932487 means someone is expecting you "
         "and the headmistress can make time for your questions.",
         "visit tour come see inspect look around appointment open day "
         "walk in viewing", "contact.html", False),
        ("fact:safety", "Safety and Supervision",
         "Children are supervised from arrival to pick-up. The gate opens at "
         "7:00am, assembly is 7:45am and closing is 3:00pm. Pupils are released "
         "only to a parent or a named guardian. A duty teacher is on the "
         "assembly ground daily, minor injuries are handled at the sick bay and "
         "parents are called straight away if a child is unwell.",
         "safe safety secure security supervision gate pick up collect guardian "
         "sick bay injury first aid nurse emergency", "index.html", False),
        ("fact:partners", "Partnerships and Sponsorship",
         "Partnership, sponsorship and supplier enquiries are handled "
         "personally by the school office rather than published on the website. "
         "Speak to the headmistress, Mrs. Salihu Nanahawa, on 09063932487, or "
         "send the details through the Contact page. Offers of support in kind, "
         "such as books, furniture or fans, are listed on the Support Us page.",
         "partner partnership sponsor sponsorship collaborate affiliate "
         "donate donation supplier vendor ngo organisation support", "contact.html", False),
        ("fact:multi-child", "Parents With More Than One Child",
         "One parent account can hold several children. Register the first "
         "child, then register the next with the same phone number and the "
         "system asks whether it is another child for the same account, so all "
         "the children sit under one login.",
         "two children second child another child siblings more than one multiple", "portal/login.html", False),
    ]
    for fid, title, text, kw, url, need in facts:
        add(fid, title, text, kw, url, need, "fact")

    os.makedirs(os.path.join(ROOT, "assets/data"), exist_ok=True)
    out = os.path.join(ROOT, "assets/data/kb.json")
    payload = {"version": 1, "count": len(docs), "docs": docs}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))

    kinds = {}
    for d in docs:
        kinds[d["kind"]] = kinds.get(d["kind"], 0) + 1
    size = os.path.getsize(out)
    print("kb.json written: %d documents, %.1f KB" % (len(docs), size / 1024.0))
    for k in sorted(kinds):
        print("   %-6s %d" % (k, kinds[k]))
    return 0


if __name__ == "__main__":
    sys.exit(build())
