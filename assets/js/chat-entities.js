/* ============================================================================
   Treasure Bot - entity understanding
   ----------------------------------------------------------------------------
   The difference between a search box and an assistant is that an assistant
   works out WHAT you are asking about, not just which page mentions your words.

   "my child's cardigan is missing" is not a request for the Lost & Found page.
   It is a lookup: item = cardigan, intent = lost property. The honest answer is
   either "yes, a cardigan is waiting at the office" or "no cardigan has been
   handed in - but these five things have, and here is what to do next".

   Never a dead end. If the specific thing is not there, say so plainly and
   then give the next most useful thing. That is the rule this file exists for.
   ========================================================================== */
(function (global) {
  "use strict";

  /* Every word a parent might use for a thing the school actually holds.
     The left side is what people type; the right side is what our data calls
     it. Without this, "jumper", "sweater" and "cardi" all miss a cardigan. */
  var THINGS = {
    cardigan: ["cardigan", "cardi", "sweater", "jumper", "pullover", "sweatshirt", "woolen", "woollen"],
    shirt: ["shirt", "top", "blouse", "tee", "t-shirt", "uniform top"],
    skirt: ["skirt", "pinafore", "gown"],
    shorts: ["shorts", "short", "trouser", "trousers", "pant", "pants", "knicker"],
    sandals: ["sandal", "sandals", "shoe", "shoes", "footwear", "slippers"],
    socks: ["sock", "socks", "stocking", "stockings"],
    beret: ["beret", "cap", "hat", "headgear"],
    sportswear: ["sportswear", "sports wear", "kit", "jersey", "track suit", "tracksuit", "pe kit"],
    bag: ["bag", "backpack", "school bag", "satchel", "knapsack"],
    lunchbox: ["lunch box", "lunchbox", "food flask", "flask", "food warmer", "plate", "cutlery", "spoon"],
    bottle: ["water bottle", "bottle", "flask", "cup"],
    book: ["book", "textbook", "note book", "notebook", "exercise book", "copy"],
    pen: ["pen", "biro", "pencil", "marker", "eraser", "ruler", "crayon"],
    umbrella: ["umbrella", "raincoat", "rain coat"],
    glasses: ["glasses", "spectacles", "eye glass", "goggles"],
    watch: ["watch", "wristwatch", "wrist watch"],
    money: ["money", "cash", "purse", "wallet"]
  };

  /* Class names as parents write them. "p3", "primary three", "basic 3". */
  var CLASS_WORDS = {
    "creche": ["creche", "crèche", "daycare", "day care", "baby class"],
    "pre-nursery": ["pre-nursery", "pre nursery", "prenursery", "playgroup", "play group", "toddler"],
    "nursery 1": ["nursery 1", "nursery one", "n1", "nur 1"],
    "nursery 2": ["nursery 2", "nursery two", "n2", "nur 2"],
    "primary 1": ["primary 1", "primary one", "p1", "basic 1", "class 1", "grade 1"],
    "primary 2": ["primary 2", "primary two", "p2", "basic 2", "class 2", "grade 2"],
    "primary 3": ["primary 3", "primary three", "p3", "basic 3", "class 3", "grade 3"],
    "primary 4": ["primary 4", "primary four", "p4", "basic 4", "class 4", "grade 4"],
    "primary 5": ["primary 5", "primary five", "p5", "basic 5", "class 5", "grade 5"],
    "primary 6": ["primary 6", "primary six", "p6", "basic 6", "class 6", "grade 6"]
  };

  var SUBJECTS = {
    "mathematics": ["maths", "math", "mathematics", "arithmetic", "number work"],
    "english language": ["english", "english language", "literacy", "grammar", "comprehension"],
    "basic science": ["science", "basic science", "biology", "physics", "chemistry"],
    "social studies": ["social studies", "social", "civic", "civics"],
    "c.r.s": ["crs", "c.r.s", "christian religious", "religious studies", "bible"],
    "creative arts": ["creative art", "creative arts", "art", "drawing", "handwork"],
    "verbal reasoning": ["verbal", "verbal reasoning"],
    "quantitative reasoning": ["quantitative", "quantitative reasoning", "quantitative aptitude"],
    "phonics": ["phonics", "sound foundation", "sounding"],
    "computer": ["computer", "computing", "ict", "coding", "programming", "computer science"],
    "handwriting": ["handwriting", "writing", "penmanship"]
  };

  /* What the person is trying to DO. Checked in order, so the most specific
     phrasing wins over a bare topic word. */
  var INTENTS = [
    ["lost", /\b(lost|lose|losing|missing|misplace[d]?|left behind|can'?t find|cannot find|find my|found any|anyone (found|seen)|has anyone)\b/],
    ["staffcount", /\bclass size|\bhow (big|large|many)\b[^.?!]{0,20}\bclass\b|\bpupils? per class\b|\bchildren per class\b/],
    ["classlist", /\b(what classes|which classes|what levels|what grades|classes do you (have|offer)|do you have (a )?(creche|nursery|primary)|take babies|accept babies|youngest|age (do you|range|group)|from what age|how young)\b|\b(\d+|six|three|two|four|five)[ -]?(month|year)s?[ -]?old\b|\bcheapest|most affordable|lowest fee\b/],
    ["classinfo", /\b(what (happens|do they do|is taught|do you do)|tell me about|what is|describe|activities|learn|is there|do they have|does .* have)\b[^.?!]{0,35}\b(creche|cr[eè]che|pre[- ]?nursery|nursery|primary|class)\b|\b(creche|pre[- ]?nursery|nursery [12]|primary [1-6])\b[^.?!]{0,20}\b(like|about|learn|do|activit|taught|cover)\b/],
    ["elearning", /\b(e[- ]?learning|elearning|online learning|online class|cbt|practice question|practice test|mock|revision|portal work|how does the portal)\b/],
    ["activity", /\b(club|clubs|excursion|excursions|debate|quiz|reading club|coding|extra[- ]?curricular|after school|activit\w*|show ?(and|&) ?tell|trip|trips|outing)\b/],
    ["homework", /\b(homework|home work|assignment|assignments|after school work|holiday work)\b(?![^.?!]*\b(for me|write|do it|answer)\b)/],
    ["testimonial", /\b(testimonial|testimonials|review|reviews|what do parents say|parents say|feedback from parent|recommend|rating|opinion)\b/],
    ["curriculum", /\b(subject|subjects|curriculum|syllabus|what do you teach|do you teach|is .* taught|lesson|lessons|topics?)\b/],
    ["multichild", /\b(more than one child|two children|second child|another child|both (my )?children|siblings?|all my children|same account)\b/],
    ["notpublished", /\b(refund\w*|instal?ment\w*|part payment|pay in bits|spread the payment|interview (parents|the parent)|entrance exam|entry test|assessment test)\b|\bcannot afford|can'?t afford\b/],
    ["whotomeet", /\bwho (do|will|should) i (meet|see|talk to|speak to)\b|\bwho (attends to|receives) (visitors|parents)\b/],
    ["transfer", /\b(transfer\w*|moving from|coming from another|changing school|switch school|mid[- ]?term entry|previous school)\b/],
    ["afterreg", /\bwhat (happens|next|do i do)\b[^.?!]{0,25}\b(after|once|when)\b[^.?!]{0,25}\b(regist\w*|apply|applied|pay|paid|submit)\b|\bnext step\b/],
    ["documents", /\b(document|documents|paper|papers|requirement|requirements|birth certificate|passport photo\w*|photo\w*|immunisation|immunization|report card|what (do i|to) bring|what is needed|credential)\b/],
    ["receipt", /\b(receipt|teller|proof of payment|payment slip|verify|genuine|authentic|confirm (my )?payment)\b/],
    ["trackapp", /\b(track|status of (my )?(application|admission)|application status|admission status|check (my )?(application|admission))\b|\bhow (do|will) i know\b[^.?!]{0,30}\b(admitted|accepted|got in|successful)\b/],
    ["contactinfo", /\b(contact (you|the school|us)|how (do|can) i (contact|reach|call|message)|phone number|your number|email|e-mail|reach you|get in touch|how (fast|quickly|soon).*(reply|respond)|reply time)\b/],
    ["officehours", /\b(office hour|opening hour|open on (saturday|sunday|weekend)|are you open|when are you open|working day|working hour)\b/],
    ["complaint", /\b(complain|complaint|anonymous|suggestion box|report (a|an) (problem|issue|teacher)|unhappy|dissatisfied|grievance)\b/],
    ["passwordhelp", /\b(create (a )?password|forgot (my )?password|reset (my )?password|can'?t log ?in|cannot log ?in|registration number|login detail|otp)\b/],
    ["overview", /^\s*(tell me about|what about|describe|info(rmation)? about|talk about|explain)\s+(the\s+|your\s+|this\s+)?(school|treasure|academy|place|it)\s*[.?!]?\s*$|^\s*(what is|who are)\s+(this|the)?\s*(school|treasure academy|treasure)\s*[.?!]?\s*$/],
    ["leadership", /\bwho (is|are)\b[^.?!]{0,20}\b(in charge|head|headmistress|principal|leader|leading|running|manage|boss|authority)\b|\bhead ?(mistress|master|teacher)\b|\bwho manages\b/],
    ["staffinfo", /\b(tell me about|who are|list|meet)\b[^.?!]{0,15}\b(staff|teachers|team)\b|\b(school administrator|administrator|administration|admin staff|support staff|non[- ]teaching)\b|\bhow qualified\b|\bwho (handles|runs|manages)\b[^.?!]{0,15}\b(admin\w*|office)\b/],
    ["pickup", /\b(who can (collect|pick)|pick ?up|collect my child|release my child|drop off|hand over|dismissal)\b/],
    ["founder", /\b(founder|founded|found the school|who started|who built|who created|who owns|owner|proprietress|proprietor|establish(ed)?|set up|began|origin|since when|how old is the school|how long have you)\b/],
    ["mission", /\b(mission|vision|motto|aim|aims|goal|goals|purpose|philosophy|values|believe|belief|what do you stand for|ethos)\b/],
    ["history", /\b(history|story|background|journey|milestone|milestones|timeline|over the years|past)\b|\bhow did\b[^.?!]{0,25}\b(start|begin|found)\b|\bwhen did\b[^.?!]{0,30}\b(move|open|launch|start|begin|built|relocat)\b|\bwhat year\b/],
    ["facilities", /\bfacilit\w*\b|\b(library|computer room|computer lab|ict|playground|play ground|play area|classroom|building|premises|compound|equipment|amenit|what do you have|infrastructure|swimming|pool|field|hall|sick bay|clinic|boarding|boarder|hostel|dormitory|day school)\b/],
    ["performance", /\b(pass rate|result rate|common entrance|how well|performance|perform|achievement|success|record|graduate|alumni|secondary school|secondary schools)\b|\bhow do\b[^.?!]{0,25}\b(pupil|pupils|student|students|children)\b[^.?!]{0,15}\b(do|perform|fare)\b/],
    ["staffcount", /\bhow many\b[^.?!]{0,20}\b(teacher|teachers|staff|pupil|pupils|student|students|children|child|class|classes)\b|\bnumber of (teacher|staff|pupil|student|child)/],
    ["employment", /\b(job|jobs|vacancy|vacancies|employ|employment|hiring|hire|recruit|teaching job|career|careers|cv|curriculum vitae)\b|\b(send|submit|attach|my)\s+(my\s+)?resum[eé]\b|\b(i|we|my)\b[^.?!]{0,25}\b(work|working|teach|teaching|join)\b[^.?!]{0,30}\b(there|here|with you|for you|at your|in your|as a teacher|as teacher|your school|the school)\b|\bcan i (work|teach|join)\b|\bapply\b[^.?!]{0,20}\b(teach|job|position|role|work)\b|\b(need|want|looking for|require|recruiting)\b[^.?!]{0,15}\b(teacher|teachers|staff|worker|workers|employee)\b/],
    ["partner", /\b(partner|partners|partnership|sponsor|sponsors|sponsorship|collaborat|affiliat|accredit|associate with|work with|donor|ngo)\b/],
    ["enrol", /\b(enrol\w*|admission\w*|admit|apply|application|register my|registering|bring my child|join the school|new pupil|start school|place for my|space for my|vacancy for my child|accept)\b/],
    ["visit", /\b(visit|tour|come and see|inspect|look around|open day|see the school|appointment)\b/],
    ["location", /\b(where|located|location|address|direction|how do i get|how to get|find the school|map|which (town|state|area))\b/],
    ["price", /\b(how much|price|cost|costs|fee|fees|pay|payment|expensive|cheap|naira)\b|\bcharges?\b(?![^.?!]*\b(of|in charge)\b)/],
    ["timetable", /\b(timetable|time table|schedule|when is|what time|period|lesson plan)\b/],
    ["result", /\b(result|results|report card|grade|score|performance|position in class)\b/],
    ["contact", /\b(contact|call|phone|number|whatsapp|email|reach|speak to|talk to)\b/],
    ["compare", /\b(why (should|choose)|better than|compare|different from|what makes|why treasure|advantage)\b/],
    ["safety", /\b(safe|safety|secure|security|fence|gate|cctv|supervis|first aid|sick|nurse|injur)\b/],
    ["food", /\b(food|meal|meals|lunch|feed|feeding|eat|snack|diet|canteen|kitchen)\b/]
  ];

  /* Nigerian English, normalised to the phrasing the rules expect. Parents
     type how they speak; the rules should not have to know both. */
  var PIDGIN = [
    [/\bwetin dey happen (for|in)\b/g, "what happens in"],
    [/\bwetin\b/g, "what"],
    [/\babeg\b/g, ""],
    [/\bwho be\b/g, "who is"],
    [/\bwhich year\b/g, "what year"],
    [/\buna\b/g, "you"],
    [/\bdem dey\b/g, "they"],
    [/\bdey teach\b/g, "teach"],
    [/\byou get\b/g, "do you have"],
    [/\bi wan\b/g, "i want to"],
    [/\bmy pikin\b/g, "my child"],
    [/\bpikin\b/g, "child"],
    [/\btalk about\b/g, "say about"],
    [/\bhow much be\b/g, "how much is"],
    [/\bdey for\b/g, "are in"],
    [/\bcome your\b/g, "to your"],
    [/\bsabi\b/g, "know"],
    [/\bhow far\b(?=[^.?!]*\b(my|the|our)\b)/g, "what is the status of"],
    [/\bi need bring\b/g, "what do i bring"],
    [/\bi wan\b/g, "i want to"],
    [/\bcheap pass\b/g, "cheapest"],
    [/\bi don\b/g, "i have"],
    [/\bi forget\b/g, "i forgot"],
    [/\bna real one\b/g, "genuine"],
    [/\bhow i go\b/g, "how do i"],
    [/\bcome school\b/g, "to school"]
  ];

  function norm(s) {
    var t = " " + String(s || "").toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim() + " ";
    for (var i = 0; i < PIDGIN.length; i++) {
      t = t.replace(PIDGIN[i][0], PIDGIN[i][1]);
    }
    return " " + t.replace(/\s+/g, " ").trim() + " ";
  }

  /* Find which known thing the sentence is about. Longest phrase wins so
     "water bottle" beats "bottle". */
  function findIn(map, text) {
    var t = norm(text), best = null, bestLen = 0;
    for (var key in map) {
      if (!map.hasOwnProperty(key)) continue;
      for (var i = 0; i < map[key].length; i++) {
        var word = map[key][i];
        if (t.indexOf(" " + word + " ") >= 0 ||
            t.indexOf(" " + word + "s ") >= 0 ||
            t.indexOf(" " + word + "'s ") >= 0) {
          if (word.length > bestLen) { best = key; bestLen = word.length; }
        }
      }
    }
    return best;
  }

  function detectIntent(text) {
    var t = norm(text);
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i][1].test(t)) return INTENTS[i][0];
    }
    return null;
  }

  /* Does a stored record match the thing the user named? Checks the record's
     own words against every synonym of that thing. */
  function recordMatches(recordText, thingKey) {
    if (!thingKey) return false;
    var r = norm(recordText);
    var words = THINGS[thingKey] || [thingKey];
    for (var i = 0; i < words.length; i++) {
      if (r.indexOf(words[i]) >= 0) return true;
    }
    return false;
  }

  global.TAEntities = {
    THINGS: THINGS,
    CLASS_WORDS: CLASS_WORDS,
    SUBJECTS: SUBJECTS,
    norm: norm,
    thing: function (t) { return findIn(THINGS, t); },
    klass: function (t) { return findIn(CLASS_WORDS, t); },
    subject: function (t) { return findIn(SUBJECTS, t); },
    intent: detectIntent,
    matches: recordMatches,

    /* Everything understood about one sentence, in one object. */
    read: function (text) {
      return {
        intent: detectIntent(text),
        thing: findIn(THINGS, text),
        klass: findIn(CLASS_WORDS, text),
        subject: findIn(SUBJECTS, text)
      };
    }
  };
})(typeof window !== "undefined" ? window : this);
