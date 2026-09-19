# ☀️ Treasure Academy, Ageva — Website + School Portal

> **Our God is able** — Creche to Primary 6
> Public website (Home, News/Event, About, Contact) + **Headmistress**, **Teacher** and **Pupil/Parent** portals.

> 📌 **"Treasure Academy" is a placeholder name.** Tell me your mum's real school name and I change it everywhere —
> or edit it yourself in **Admin → Settings** (updates the whole site instantly).

---

## 🌍 Public pages

| Page | File | Highlights |
|------|------|------------|
| 🏠 Landing | `index.html` | Nav (Home, News/Event, About, Contact, Login/Register) + ☀️/🌙 **day-night toggle** • **Promotions slider** (static if 1, sliding if many) • **News/Event slider** • stats, programs, gallery, testimonials, admissions |
| 📖 About Us | `about.html` | Brief history, mission/vision, milestones timeline, HM quote • nav & footer auto-hide "About" (you're already there!) |
| 📞 Contact Us | `contact.html` | Contact form → straight to school inbox (reply goes to sender's email) • **WhatsApp cards** with beeping 🟢 online / ⚪ offline dots + pre-written chat message • **FAQ accordion** |
| 🎬 News/Event | `news.html` | Filters (News/Event + month) • **YouTube-style video rail** • **masonry photo gallery** • list of **7 per page** with animated "slide → next / ← previous" prompts • clip animations everywhere |
| 📄 Full Story | `story.html?id=...` | Full news/event story, view counter, YouTube embed (if admin adds a link), related stories |

**Every public page also has:** 🤖 **Treasure chatbot** (right side, draggable — answers questions about admissions, fees, results, contact + typewriter effects + search) and ⏰ **live analog clock** (bottom-left, draggable — shows Opening 7:00, Assembly 7:45, Study 8:00, Break 10:00, Closing 3:00 in real time!).

**Footer:** Quick Links (auto-hides current page) • Email / Tel / Address trio with icons • social handles • © auto-year.

## 🔐 Login / Register (`portal/login.html`)

Glassmorphism flip card 💎 floating labels, glowing border, shake-on-error, show/hide password 👁️:

- **🎒 Pupil login:** Registration No + Password + Remember me + **Treasure captcha** (school-made: match letters & pictures — no Google!)
- **✨ Create Password (OTP style):** for reg numbers without password — 4-digit code → 4 boxes → new + confirm → Activate → loading → success toast
- **🔑 Forgot Password modal** on wrong password: Try Again 🔄 or Reset with OTP
- **👩‍🏫 Staff tab:** Admin/Teacher ID + PIN (portals unchanged)
- **📝 Registration (flip side):** 3-step wizard with progress bar — **Step 1** Ward info (surname, first, other names, DOB, gender, class, blood group…) • **Step 2** Guardian 1 & 2 (name, phone, gender) + address • **Step 3** Payment (Pay now demo / Pay at school) • Treasure check • ⏰ must visit school **within 2 weeks** or it expires!

| Demo login | ID | Password |
|---|---|---|
| 🎒 Pupil (has password) | `TA/2023/001` | `1234` |
| 🆕 Pupil (no password — try Create Password!) | `TA/2023/003` | — |
| 👩‍🏫 Teacher | `T001` | PIN `1234` |
| 👩‍💼 Headmistress | `HEAD001` | PIN `1234` |

## 👩‍💼 Headmistress Admin (`portal/admin.html`)

Everything from before (Overview, Pupils, Teachers, Duty Roster + instant dashboard alerts 🔔, Results approve→publish, Attendance) **PLUS:**

- 📝 **Registrations** — full 3-step details, Paid/Unpaid, ⏰ countdown to 2-week deadline (auto-expires!), **Complete Payment** button, **Admit** → auto-creates pupil + 🎲 password generated from name
- 📣 **Promotions** — add/edit homepage promos (1 = static, 2+ = sliding!)
- 🎬 **News/Events** — add/edit with News/Event type, date, photo, **YouTube link**, story → feeds sliders, videos, gallery, lists
- 💌 **Messages** — contact-form inbox (reply to sender's email)
- 💬 **WhatsApp** — manage chat contacts + 🟢/⚪ Active toggle (controls beeping dot on Contact page!)
- 🎒 Pupils now show **login passwords** + 🎲 generate-from-name button (empty = pupil must use OTP Create Password)

## 🛠️ Demo notes

- Data lives in the browser (`localStorage`) — old demo data **auto-migrates**; reset anytime via **Admin → Settings → Reset Demo Data**.
- Try the magic flow: **Register online → Admin admits → Pupil creates password → checks result. 🎉**

## 📁 Files

```
mums-school-website/
├── index.html  about.html  contact.html  news.html  story.html
├── portal/  login.html  admin.html  teacher.html  pupil.html
├── assets/css/  main.css  extra.css
├── assets/js/  store.js (database)  site.js (theme/chatbot/clock Sliders/captcha)
└── assets/img/  6x kiddies artwork  +  README.md
```

## 🚀 Going live (when ready)

1. Real school name, address, phone & fees → I update everything.
2. Real backend (shared data across all devices) + online payments + real emails.
3. Deploy to the school's domain (like occidoma.com).

Made with 💛 for our little stars.
