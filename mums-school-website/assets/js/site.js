/* ============================================================
   TREASURE ACADEMY — shared public-site engine
   theme • nav • footer • chatbot • clock • sliders • captcha
   ============================================================ */
const Site = { page: document.body.dataset.page || "home" };

/* ---------------- THEME (day/night) ---------------- */
const Theme = {
  init(){
    const ICON_MOON='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>',ICON_SUN='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3L19 19M19 5l-1.7 1.7M6.7 17.3L5 19"/></svg>';
    document.querySelectorAll(".navbar .container").forEach(c=>{ if(!c.querySelector(".theme-btn")){ const d=document.createElement("div"); d.className="nav-cta-row"; /* theme switch lives only on major pages (home + portal dashboards + login has its own) */
    const pg = document.body.dataset.page || "";
    if(pg==="home"){ d.innerHTML='<button class="theme-btn" title="Switch to night">'+ICON_MOON+'</button>'; } c.appendChild(d); } });
    /* mobile nav: two rows, all links visible — no hamburger (2026-09-16) */

    const autoDark=()=>{ const h=new Date().getHours(); return (h>=19||h<6)?"dark":"light"; };
    const storedOv=localStorage.getItem("treasure_theme");
    const t = storedOv || autoDark();
    document.documentElement.dataset.theme = t;
    if(!storedOv){ try{ setInterval(()=>{ if(!localStorage.getItem("treasure_theme")){ document.documentElement.dataset.theme=autoDark(); setTC(document.documentElement.dataset.theme); } },10*60*1000); }catch(e){} }
    const setTC=th=>{ let m=document.querySelector('meta[name="theme-color"]'); if(!m){ m=document.createElement("meta"); m.name="theme-color"; document.head.appendChild(m); } m.content=th==="dark"?"#0C1B14":"#0B7A37"; };
    setTC(t);
    document.querySelectorAll(".theme-btn").forEach(b=>{
      b.innerHTML = t==="dark" ? ICON_SUN : ICON_MOON;
      b.title = t==="dark" ? "Switch to daytime" : "Switch to night";
      b.onclick = ()=>{
        const nt = document.documentElement.dataset.theme==="dark" ? "light" : "dark";
        document.documentElement.dataset.theme = nt; setTC(nt);
        localStorage.setItem("treasure_theme", nt);
        b.innerHTML = nt==="dark" ? ICON_SUN : ICON_MOON;
        b.title = nt==="dark" ? "Switch to daytime" : "Switch to night";
      };
    });
  }
};

const SEARCH_INDEX=[
 {t:"Home",u:"index.html",k:"home main start treasure academy ageva"},
 {t:"About Us",u:"about.html",k:"about story headmistress founder motto mission history"},
 {t:"Admissions",u:"admissions.html",k:"admissions apply enrol register form join track application requirements receipt verify payment check confirm authentic"},
 {t:"Academics",u:"academics.html",k:"academics classes creche nursery primary curriculum subjects"},
 {t:"Contact Us",u:"contact.html",k:"contact phone call whatsapp address location map email message faq directions suggestion box idea vote"},
 {t:"News & Events",u:"news.html",k:"news event sport party excursion graduation video photo gallery story rsvp seats reserve"},
 {t:"Staff",u:"staff.html",k:"staff teachers names who teaches team"},
 {t:"E-Learning",u:"elearning.html",k:"elearning practice cbt common entrance primary 6 past questions"},
 {t:"Shop",u:"shop.html",k:"shop buy books uniform price textbook notebook order pickup"},
 {t:"PTA",u:"pta.html",k:"pta parents association meeting levy"},
 {t:"Alumni",u:"alumni.html",k:"alumni graduates old pupils secondary success wall share story"},
 {t:"Birthdays",u:"birthdays.html",k:"birthday staff celebrate wish song headmistress"},
 {t:"Calendar",u:"calendar.html",k:"calendar term dates resumption holiday events countdown"},
 {t:"Notice Board",u:"board.html",k:"notice board announcements news"},
 {t:"Homework Board",u:"homework.html",k:"homework assignment class study"},
 {t:"Lost & Found",u:"lost-found.html",k:"lost found missing item claim clothes"},
 {t:"Photo Day",u:"photo-day.html",k:"photo day picture portrait booking photography"},
 {t:"Uniform List",u:"uniform.html",k:"uniform price list clothes wear dress shop"},
 {t:"Open Day",u:"openday.html",k:"open day visit tour reserve seat prospective"},
 {t:"Reading Corner",u:"reading.html",k:"reading books library story month leaderboard top readers"},
 {t:"Exam Timetable",u:"exams.html",k:"exam timetable test date papers revision"},
 {t:"Holiday Assignments",u:"holiday.html",k:"holiday assignment break work home"},
 {t:"Welcome Pack",u:"welcome.html",k:"welcome pack new parents guide steps start"},
 {t:"Graduates",u:"graduates.html",k:"graduates primary 6 class of sendforth"},
 {t:"Transport",u:"transport.html",k:"transport bus route pickup dropoff fees driver"},
 {t:"Volunteer",u:"volunteer.html",k:"volunteer help event sign up parents support"},
 {t:"Portal Login",u:"portal/login.html",k:"portal login register results password dashboard pupil parent teacher admin"},
 {t:"Parent Reviews",u:"testimonials.html",k:"testimonials reviews parents say rating all reviews"},
 {t:"Class Pages",u:"class.html",k:"class page creche nursery primary activities gallery"}
];
const Search={
 init(){
  if(!document.getElementById("mainNav")||document.getElementById("searchBtn"))return;
  const row=document.querySelector(".navbar .nav-cta-row"); if(!row)return;
  const b=document.createElement("button"); b.id="searchBtn"; b.className="theme-btn"; b.title="Search this website";
  b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>';
  b.onclick=()=>this.open();
  row.insertBefore(b,row.firstChild);
  const v=document.createElement("div"); v.id="searchVeil"; v.className="search-veil";
  v.innerHTML='<div class="search-box"><div class="search-row"><input id="searchInput" placeholder="Search pages, e.g. fees, bus, uniform..." autocomplete="off"><button id="searchX" aria-label="Close">×</button></div><div id="searchRes" class="search-res"></div></div>';
  document.body.appendChild(v);
  v.addEventListener("click",e=>{ if(e.target===v)this.close(); });
  document.getElementById("searchX").onclick=()=>this.close();
  document.addEventListener("keydown",e=>{ if(e.key==="Escape")this.close(); });
  document.getElementById("searchInput").addEventListener("input",e=>this.go(e.target.value));
  const sug=document.createElement("div"); sug.id="searchSug"; sug.className="search-sug"; document.querySelector(".search-box").appendChild(sug);
  document.getElementById("searchInput").addEventListener("input",e=>this.suggest(e.target.value));
  sug.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b)return; document.getElementById("searchInput").value=b.dataset.q; this.go(b.dataset.q); sug.innerHTML=""; });
  document.getElementById("searchRes").addEventListener("click",e=>{
    if(e.target.closest("#clearRec")){ try{localStorage.removeItem("treasure_recent_search");}catch(x){} this.go(""); return; }
    const a=e.target.closest("a"); if(!a)return;
    if(a.dataset.re){ e.preventDefault(); document.getElementById("searchInput").value=a.dataset.re; this.go(a.dataset.re); }
    else this.save(this._q);
  });
  document.getElementById("searchInput").addEventListener("keydown",e=>{
    const links=[...document.querySelectorAll("#searchRes a[href]")];
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault();
      let i=links.findIndex(a=>a.classList.contains("sel"));
      i=e.key==="ArrowDown"?(i+1)%Math.max(1,links.length):(i<=0?links.length-1:i-1);
      links.forEach(a=>a.classList.remove("sel")); if(links[i]){links[i].classList.add("sel"); if(links[i].scrollIntoView)links[i].scrollIntoView({block:"nearest"});} return; }
    if(e.key==="Enter"){ const f=document.querySelector("#searchRes a.sel")||document.querySelector("#searchRes a"); if(f)f.click(); }
  });
 },
 open(){ document.getElementById("searchVeil").classList.add("open"); const i=document.getElementById("searchInput"); i.value=""; this.go(""); setTimeout(()=>i.focus(),50); },
 close(){ const v=document.getElementById("searchVeil"); if(v)v.classList.remove("open"); },
 go(q){
  q=String(q||"").toLowerCase().trim(); this._q=q;
  const box=document.getElementById("searchRes");
  if(q.length<2){
    const rec=this.recent();
    box.innerHTML=(rec.length?'<p class="sub">Your recent searches <button class="link-btn" id="clearRec" style="font-size:.78rem">Clear</button></p>'+rec.map(r=>`<a href="#" data-re="${U.esc(r)}">${U.esc(r)} &#8594;</a>`).join(""):'')
     +'<p class="sub">Popular pages</p>'+SEARCH_INDEX.slice(0,6).map(p=>`<a href="${p.u}"><b>${U.esc(p.t)}</b></a>`).join("");
    return;
  }
  const stem=w=>w.length>4&&w.endsWith("ies")?w.slice(0,-3)+"y":w.length>4&&w.endsWith("es")?w.slice(0,-2):w.length>3&&w.endsWith("s")?w.slice(0,-1):w;
  const words=q.split(/\s+/).filter(w=>w.length>=3);
  const match=(text,qq)=>{ text=String(text||"").toLowerCase(); if(text.includes(qq))return true;
    return words.some(w=>text.includes(w)||text.includes(stem(w))); };
  const hl=text=>{ let e=U.esc(text); try{ const rx=new RegExp("("+q.split(/\s+/).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")","ig"); e=e.replace(rx,"<mark>$1</mark>"); }catch(x){} return e; };
  const hits=SEARCH_INDEX.filter(p=>match(p.t+" "+p.k,q)).slice(0,8);
  let extra="";
  try{
    const db=DB.load(), today=U.todayStr();
    const news=(db.newsEvents||[]).filter(n=>(!n.publishAt||n.publishAt<=today)&&match(n.title+" "+(n.text||""),q)).slice(0,3);
    if(news.length)extra+='<p class="sub">News & events</p>'+news.map(n=>`<a href="story.html?id=${n.id}">${hl(n.title)}</a>`).join("");
    const staff=(db.teachers||[]).filter(t=>match((t.name||"")+" "+(t.class||"")+" "+((t.subjects||[]).join(" ")),q)).slice(0,3);
    if(staff.length)extra+='<p class="sub">Staff</p>'+staff.map(t=>`<a href="staff.html">${hl(t.name)} — ${U.esc(t.class||"")}</a>`).join("");
    const ex=(db.exams||[]).filter(x=>match(x.subject||"",q)).slice(0,2);
    if(ex.length)extra+='<p class="sub">Exams</p>'+ex.map(x=>`<a href="exams.html">${hl(x.subject)} — ${U.shortDate(x.date)}</a>`).join("");
    const shop=(db.shopItems||[]).concat(db.uniform||[]).filter(x=>match(x.name||"",q)).slice(0,2);
    if(shop.length)extra+='<p class="sub">Shop & uniform</p>'+shop.map(x=>`<a href="shop.html">${hl(x.name)} — ${U.naira(x.price)}</a>`).join("");
  }catch(e){}
  const total=hits.length+(extra?extra.split("<a ").length-1:0);
  box.innerHTML=`<p class="sub">${total} result${total===1?"":"s"}</p>`
   +(hits.map(p=>`<a href="${p.u}"><b>${hl(p.t)}</b><small>${U.esc(p.u.replace(".html","").replace("portal/","portal — "))}</small></a>`).join("")+extra
     ||'<div class="empty">Nothing found — try "fees", "bus" or "uniform".</div><p class="sub">Popular pages</p>'+SEARCH_INDEX.slice(0,6).map(p=>`<a href="${p.u}"><b>${U.esc(p.t)}</b></a>`).join(""));
 },
 recent(){ try{ return JSON.parse(localStorage.getItem("treasure_recent_search")||"[]"); }catch(e){ return []; } },
 suggest(q){
  const box=document.getElementById("searchSug"); if(!box)return;
  q=String(q||"").toLowerCase().trim();
  if(q.length<2){ box.innerHTML=""; return; }
  const terms={};
  SEARCH_INDEX.forEach(p=>{ (p.t+" "+p.k).toLowerCase().split(/\s+/).forEach(w=>{ if(w.startsWith(q)&&w.length>2)terms[w]=1; }); });
  try{ (DB.load().newsEvents||[]).forEach(n=>String(n.title||"").toLowerCase().split(/\s+/).forEach(w=>{ if(w.startsWith(q)&&w.length>2)terms[w]=1; })); }catch(e){}
  const list=Object.keys(terms).slice(0,5);
  box.innerHTML=list.map(w=>`<button data-q="${U.esc(w)}">${U.esc(w)}</button>`).join("");
 },
 save(q){
  q=String(q||"").trim(); if(q.length<2)return;
  try{ let r=this.recent().filter(x=>x.toLowerCase()!==q.toLowerCase()); r.unshift(q); localStorage.setItem("treasure_recent_search",JSON.stringify(r.slice(0,5))); }catch(e){}
 }
};
/* ---------------- NAV + FOOTER ---------------- */
const NAV_ITEMS=[
  {id:"home",label:"Home",href:"index.html"},
  {id:"news",label:"News/Event",href:"news.html"},
  {id:"about",label:"About Us",href:"about.html"},
  {id:"contact",label:"Contact Us",href:"contact.html"},
  {id:"login",label:"Login",href:"portal/login.html",cta:true}
];
/* explore-bar removed 2026-09-15: single clean nav; footer keeps PTA/Alumni/Birthdays links */
function renderNav(current){
  const box = document.getElementById("mainNav");
  if(!box) return;
  box.innerHTML = NAV_ITEMS.map(n=>
    n.cta ? `<a href="${n.href}" class="btn btn-mint btn-sm nav-cta">Login/Register</a>`
          : `<a href="${n.href}" class="${n.id===current?"on":""}" ${n.id===current?'aria-current="page"':""}>${n.label}</a>`
  ).join("");
}
function renderFooter(){
  const box = document.getElementById("siteFooter");
  if(!box) return;
  let s = {...SCHOOL_DEFAULTS};
  try{ s = DB.load().school; }catch(e){}
  const year = new Date().getFullYear();
  box.innerHTML = `
  <div class="site-footer"><div class="container">
    <div class="foot-main">
      <div class="foot-brand">
        <a class="logo" href="index.html" style="color:#fff"><span>${U.esc(s.name)}</span></a>
        <p>"${U.esc(s.motto)}"<br>Creche, Nursery and Primary education in Ageva, Okene. Discipline, character and results since 2015.</p>
              </div>
      <div class="foot-col foot-contact foot-center"><h4>Contact</h4>
        <div class="foot-contact-row"><span class="foot-line"><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span>${U.esc(s.email)}</span><span class="foot-line"><span class="fi"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg></span>${U.esc(s.phone)}</div>
        <p class="foot-hours"> ${U.esc((s.hours||"Mon \u2013 Fri \u2022 7:30am \u2013 3:00pm").replace("4:00pm","3:00pm"))}</p>
      </div>
      <div class="foot-col foot-visit"><h4>Visit Us</h4>
        <p><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span>${U.esc(s.address)}</p>
        <a class="btn btn-white btn-sm" href="contact.html#visit">Get Directions</a>
      </div>
      <div class="foot-col"><h4>Follow Us</h4>
        <div class="social-3d">
          <a href="https://www.facebook.com/profile.php?id=100093241642093" title="Facebook" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M13.5 9H16V6h-2.5C11.6 6 10 7.6 10 9.5V11H8v3h2v7h3v-7h2.4l.6-3h-3V9.5c0-.3.2-.5.5-.5z"/></svg></a><a href="#" title="Instagram" onclick="return soonSocial('Instagram')"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.6" cy="7.4" r="1.2" fill="currentColor" stroke="none"/></svg></a><a href="#" title="X (Twitter)" onclick="return soonSocial('X (Twitter)')"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 4l7.1 9.2L4.4 20h2.5l5.3-6 4.2 6H20l-7.4-9.6L19.3 4h-2.5l-4.8 5.5L8.2 4H4z"/></svg></a><a href="#" title="TikTok" onclick="return soonSocial('TikTok')"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.5 2.6 2.1 4.2 4.6 4.4"/></svg></a><a href="#" title="YouTube" onclick="return soonSocial('YouTube')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/></svg></a><a href="contact.html" title="WhatsApp"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg></a>
        </div>
      </div>
    </div>
  </div>
  <div class="foot-bottom"><div class="container foot-center"><span>\u00A9 ${year} ${U.esc(s.name)}. All Rights Reserved.</span></div></div>
  </div>`;
}
window.soonSocial=function(net){ U.toast("The school has not gotten "+net+" yet — check back soon!"); return false; };
function injectSchool(){
  let s = {...SCHOOL_DEFAULTS};
  try{ s = DB.load().school; }catch(e){}
  document.querySelectorAll("[data-school-name]").forEach(e=>e.textContent=s.name);
  document.querySelectorAll("[data-school-phone]").forEach(e=>{ e.textContent=s.phone; if(e.tagName==="A") e.href="tel:"+String(s.phone||"").replace(/\D/g,""); });
  document.querySelectorAll("[data-school-email]").forEach(e=>e.textContent=s.email);
  document.querySelectorAll("[data-school-address]").forEach(e=>e.textContent=s.address);
  document.querySelectorAll("[data-school-motto]").forEach(e=>e.textContent=s.motto);
  return s;
}

/* ---------------- SLIDERS (1 = static, many = sliding) ---------------- */
function initSliders(){
  document.querySelectorAll(".slider").forEach(sl=>{
    const track = sl.querySelector(".slider-track");
    if(!track) return;
    const slides = [...track.children];
    const dotsBox = sl.querySelector(".slider-dots");
    if(slides.length <= 1){ sl.classList.add("static"); return; }
    let i = 0, timer;
    slides.forEach((_,k)=>{ const d=document.createElement("button"); d.setAttribute("aria-label","slide "+(k+1)); d.onclick=()=>{go(k); restart();}; dotsBox.appendChild(d); });
    const dots=[...dotsBox.children];
    function go(k){ i=(k+slides.length)%slides.length; track.style.transform=`translateX(-${i*100}%)`; dots.forEach((d,j)=>d.classList.toggle("on",j===i)); }
    function restart(){ clearInterval(timer); timer=setInterval(()=>go(i+1), 5000); }
    const pv=sl.querySelector(".prev"), nx=sl.querySelector(".next");
    if(pv) pv.onclick=()=>{go(i-1); restart();};
    if(nx) nx.onclick=()=>{go(i+1); restart();};
    sl.addEventListener("mouseenter",()=>clearInterval(timer));
    sl.addEventListener("mouseleave",restart);
    /* finger + mouse swipe (no extra buttons needed) */
    let sx=null, mx=null, suppress=false;
    sl.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;},{passive:true});
    sl.addEventListener("touchend",e=>{ if(sx===null)return; const dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>40){ go(i+(dx<0?1:-1)); restart(); } },{passive:true});
    sl.addEventListener("pointerdown",e=>{ if(e.pointerType==="mouse") mx=e.clientX; });
    sl.addEventListener("pointerup",e=>{ if(mx===null)return; const dx=e.clientX-mx; mx=null; if(Math.abs(dx)>50){ suppress=true; go(i+(dx<0?1:-1)); restart(); } });
    sl.addEventListener("click",e=>{ if(suppress){ e.preventDefault(); e.stopPropagation(); suppress=false; } },true);
    go(0); restart();
  });
}

/* ---------------- Back-to-top (widgets hide at footer) ---------------- */
function initTopBtn(){
  if(!document.querySelector('link[href*="corporate"]'))return;
  let b=document.getElementById("topBtn");
  if(!b){ b=document.createElement("button"); b.id="topBtn"; b.title="Back to top";
    b.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
    b.onclick=()=>window.scrollTo({top:0,behavior:"smooth"}); document.body.appendChild(b); }
  const onScroll=()=>{
    const f=document.getElementById("siteFooter");
    const atBottom=f?(f.getBoundingClientRect().top<innerHeight):((innerHeight+scrollY)>document.body.scrollHeight-120);
    b.classList.toggle("show",!!atBottom);
    document.body.classList.toggle("at-bottom",!!atBottom);
  };
  addEventListener("scroll",onScroll,{passive:true}); onScroll();
}

/* ---------------- Reveal on scroll ---------------- */
function initReveal(){
  const io = new IntersectionObserver(es=>es.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add("revealed"); io.unobserve(en.target);} }),{threshold:.1});
  document.querySelectorAll(".clip,.clip-up").forEach(el=>io.observe(el));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initReveal);else initReveal();
setTimeout(()=>{try{document.querySelectorAll(".clip,.clip-up").forEach(el=>el.classList.add("revealed"));}catch(e){}},2500);

/* ---------------- Typing labels (label text types itself) ---------------- */
function typeLabels(scope){
  (scope||document).querySelectorAll("label[data-tlabel]:not([data-typed])").forEach(lb=>{
    lb.dataset.typed="1";
    const full=lb.dataset.tlabel; let ci=0;
    lb.innerHTML='<span class="txt"></span><span class="caret"></span>';
    const txt=lb.querySelector(".txt");
    const tick=()=>{ ci++; txt.textContent=full.slice(0,ci);
      if(ci<full.length) setTimeout(tick, 34); else { const c=lb.querySelector(".caret"); if(c) c.remove(); } };
    setTimeout(tick, 250);
  });
}

/* ---------------- Draggable ---------------- */
function makeDraggable(el, handle){
  handle = handle || el;
  let sx, sy, ox, oy, dragging=false;
  handle.addEventListener("pointerdown", e=>{
    if(e.target.closest("button,input,a,canvas")) return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    const r=el.getBoundingClientRect(); ox=r.left; oy=r.top;
    el.style.right="auto"; el.style.bottom="auto"; el.style.left=ox+"px"; el.style.top=oy+"px";
    try{el.setPointerCapture(e.pointerId);}catch(err){}
  });
  handle.addEventListener("pointermove", e=>{
    if(!dragging) return;
    el.style.left=Math.max(4,Math.min(innerWidth-el.offsetWidth-4, ox+e.clientX-sx))+"px";
    el.style.top=Math.max(4,Math.min(innerHeight-el.offsetHeight-4, oy+e.clientY-sy))+"px";
  });
  handle.addEventListener("pointerup", ()=>dragging=false);
}

/* ---------------- CHATBOT (Treasure) ---------------- */
const Chatbot = {
  KB: [
    {k:["admission","apply","enrol","register","form","join"], a:"<b>Admissions 2026/2027 are OPEN!</b><br>Go to <b>Login/Register</b> and flip the card to complete the 3-step registration (Ward, Guardian, Payment). You can pay online or at the school. After submitting, visit the school within <b>2 weeks</b> to complete it!"},
    {k:["fee","school fees","pay","payment","cost","price","how much"], a:"<b>School fees</b> depend on the class (Creche to Primary 6). All payments are by <b>bank transfer</b> to the school account - you get an official <b>receipt number</b> once confirmed. For exact figures, see the <b>Admissions</b> page!"},
    {k:["result","report","grade","score","check result","download"], a:"<b>Checking results is easy:</b><br>1. Go to Login/Register<br>2. Enter Registration No + Password<br>3. View and <b>download</b> the report card!<br>First time? Just enter your Registration No — the system will help you create a password."},
    {k:["password","forgot","login problem","can't login","cant login","otp"], a:"<b>Login help:</b><br>• New pupil? Enter your Registration No and the <b>Create Password</b> form appears automatically.<br>• Wrong password twice? The <b>Forgot Password</b> form pops up to verify and reset.<br>• Staff login with Staff ID + PIN."},
    {k:["contact","phone","number","call","whatsapp","address","location","where","email"], a:"<b>Reach us on the Contact page:</b> send a message (replies come to your email!) or chat on <b>WhatsApp</b>. Green beeping dot means online now! "},
    {k:["hour","time","open","close","resume","when"], a:"<b>School hours:</b> Mon–Fri, 7:30am–3:00pm.<br>Opening 7:00, Assembly 7:45, Study 8:00, Break 10:00, Closing 3:00pm. The live clock on the site shows what is happening right now!"},
    {k:["class","creche","nursery","primary","pre-nursery","age"], a:"<b>Our classes:</b> Creche (6m–2y), Pre-Nursery & Nursery (2–5y), Primary 1–6 (5–11y). Small classes with personal attention!"},
    {k:["transport","route","bus","bus stop","pickup","pick up","drop off","school bus"], a:"Yes! We run supervised <b>school transport routes</b> with morning pickup and afternoon drop-off. See routes, pickup points and fees on the <b>Transport page</b> — then visit the office to assign your child to the nearest route."},
    {k:["uniform","book","meal","food","lunch"], a:"Uniforms and books are collected at the school office after admission. Healthy meals are served fresh daily!"},
    {k:["teacher","staff","job","vacancy"], a:"Our teachers are qualified and caring. Staff login with Staff ID + PIN. For job enquiries, contact the school office."},
    {k:["news","event","sport","party","excursion","graduation","video","photo"], a:"Visit the <b>News/Event page</b> for videos, photo gallery and stories — you can even <b>download</b> photos and videos!"},
    {k:["testimon","review","say about"], a:"Read parent testimonials on the home page! Parents, teachers and pupils can also <b>submit testimonials</b> from their dashboards."},
    {k:["hello","hi","hey","good morning","good afternoon","good evening"], a:"Hello! I'm <b>Treasure</b>, your school assistant. Ask me about admissions, fees, results, or contact — anything!"},
    {k:["thank","thanks"], a:"You are most welcome! Anything else I can help with?"},
    {k:["who","headmistress","owner","principal"], a:"Our headmistress is <b>Mrs. Salihu Nanahawa</b>. Read our full story on the <b>About page</b>!"},
    {k:["bye","goodbye"], a:"Goodbye! Thank you for visiting Treasure Academy!"},
    {k:["portal","dashboard","pupil login"], a:"<b>Pupil/Parent Portal:</b> tap <b>Login/Register</b> → enter Registration No + Password → see results, attendance, notices and fees. First time? The <b>Create Password</b> form appears by itself!"},
    {k:["teacher login","staff login","staff id","pin"], a:"<b>Staff login:</b> same Login page — enter your <b>Staff ID + PIN</b> (e.g. T001). The headmistress logs in with her Admin ID. Forgot your PIN? See the headmistress to reset it."},
    {k:["e-learning","elearning","practice","cbt","common entrance","entrance"], a:"<b>E-Learning:</b> Primary 6 pupils practise <b>Common Entrance questions</b> inside the portal after login. Our pass rate is <b>100%</b>!"},
    {k:["shop","buy","book price","uniform price","textbook","notebook"], a:"Visit the <b>Shop page</b> for books, uniforms and school items with prices. Pay by <b>bank transfer</b> and pick up at the school office."},
    {k:["pta"], a:"The <b>PTA page</b> has meeting news and parent announcements. Join us — every parent is a member!"},
    {k:["alumni","graduate","old pupil"], a:"Our graduates shine in top secondary schools! See their stories on the <b>Alumni page</b>."},
    {k:["birthday"], a:"We celebrate our <b>staff and headmistress birthdays</b> — see who is celebrating on the <b>Birthdays page</b>!"},
    {k:["map","direction","locate","find the school","where is the school","opposite morak","road to school"], a:"Find us: <b>Opposite Morak Pure-Water Factory, Ageva, Kogi State</b>. Open the <b>Contact page</b> and tap <b>Directions From My Location</b> — Google Maps will guide you straight to our gate!"},
    {k:["discount","early bird","earlybird","offer","promo"], a:"There is no discount running right now. All fees are paid in full by <b>bank transfer</b> - ask the school office if you have questions."},
    {k:["how to register","register steps","3 steps","three steps","admission steps"], a:"<b>Registration is 3 easy steps:</b><br>1. Ward information<br>2. Guardian information<br>3. Payment by bank transfer<br>Then <b>visit the school within 2 weeks</b> to complete admission!"},
    {k:["average","position","report card","download result","print result"], a:"Inside the portal, results show <b>average, position and full report card</b> — and you can <b>download/print</b> it. Reports appear once teachers publish them."},
    {k:["attendance","present","absent"], a:"Parents see daily <b>attendance</b> (present/absent) inside the pupil portal. Teachers mark the register every morning."},
    {k:["fee schedule","nursery fees","creche fees","primary fees"], a:"Fees differ by class. Message us on the <b>Contact page</b> (or WhatsApp) and we will send the current <b>fee schedule</b> straight to you."},
    {k:["subject","curriculum","what do you teach"], a:"We teach the full <b>Nigerian curriculum</b> — English, Mathematics, Basic Science, plus <b>Computer & Coding Club</b>, JETS, Press and Sports clubs."},
    {k:["holiday","resumption","next term","mid-term","break"], a:"Watch the <b>News page</b> and portal <b>notices</b> for resumption dates and mid-term breaks. Right now: <b>First Term, 2026/2027 Session</b>."},
    {k:["owner","proprietor","proprietress","founder"], a:"Treasure Academy was founded in <b>2015</b> by <b>Hajiya Ramatu Musa</b>. Our headmistress is <b>Mrs. Salihu Nanahawa</b>."},
    {k:["motto"], a:"Our motto is <b>Our God is able</b> — and our mission is building effective and efficient future leaders!"},
    {k:["download photo","save photo","photo download"], a:"On the <b>News page gallery</b>, tap the <b>download arrow</b> on any photo to save it to your phone. Videos play with one tap!"},
    {k:["comment","like"], a:"Open any story to <b>like</b> it and drop a <b>comment</b> — just like Facebook! Your likes and comments are saved."},
    {k:["staff list","teachers names","who teaches"], a:"Meet our qualified team on the <b>Staff page</b> — class teachers from Creche to Primary 6."},
    {k:["class page","about primary","about nursery","about creche"], a:"Each class has its own page! Open <b>Academics</b> and pick Creche, Nursery or any Primary class to see what they learn."},
    {k:["volunteer","help at event","ushering","give time"], a:"We love parent helpers! Open the <b>Volunteer page</b>, pick an event and sign up — the school will call you before the event with details."},
    {k:["homework","assignment"], a:"Class homework is posted on the <b>Homework Board page</b> — check your child's class every evening. Holiday assignments appear on the <b>Holiday page</b>."},
    {k:["lost","missing item","found item","lost and found","cardigan","forgot item"], a:"Missing something? Check the <b>Lost & Found page</b> — found items are listed with photos. Tap <b>This is mine</b> on yours and the school will call you."},
    {k:["photo day","picture day","photograph"], a:"<b>Photo Day</b> portraits can be booked on the <b>Photo Day page</b> — pick a package, pay by bank transfer, and we will call you with your appointment."},
    {k:["open day","visit the school","tour","come and see"], a:"<b>Open Day</b> details and seat reservations are on the <b>Open Day page</b>. Come tour the school, meet the teachers and ask anything!"},
    {k:["uniform price","uniform cost","how much is uniform","school wear"], a:"Full price list is on the <b>Uniform List page</b> — pay by <b>bank transfer</b> and collect at the school shop. Full uniform Mon–Thu, sportswear Friday."},
    {k:["exam timetable","examination date","when is exam","test date"], a:"Exam dates and the full sitting plan are on the <b>Exam Timetable page</b>. Study hard — success is sure!"},
    {k:["term date","resumption date","when do we resume","school calendar","calendar"], a:"All term dates live on the <b>Calendar page</b>, with a countdown to the next big date on the homepage."},
    {k:["receipt","proof of payment","teller"], a:"Every confirmed payment gets an official <b>receipt number</b> (TA/YYYY/NNNN). Keep your bank teller/transfer reference — the office matches it and issues your receipt."},
    {k:["pta levy","levy"], a:"<b>PTA levies</b> are paid per family by bank transfer, with an official receipt for each payment. Ask the school office for the current levy."},
    {k:["sick","illness","my child is sick","hospital","health"], a:"Sorry to hear that! If your child is ill, keep them home and <b>call the school office</b> in the morning. Our sick bay cares for pupils who feel unwell during school hours."},
    {k:["how are you","how far","how is school","howfa"], a:"I'm great, thank you! Ready to help — ask me about <b>admissions</b>, <b>fees</b>, <b>results</b>, <b>transport</b> or anything else."},
    {k:["your name","who are you","what are you"], a:"I'm <b>Treasure</b>, the Treasure Academy school assistant! I answer questions about our school day and night."},
    {k:["stupid","fool","idiot","nonsense"], a:"I'm only a small school helper doing my best! Let's talk about <b>admissions</b>, <b>fees</b> or <b>results</b> instead."},
    {k:["birthday song","play song","sing"], a:"On the <b>Birthdays page</b> you can tap <b>Play Birthday Song</b> on any staff birthday card — plus copy a ready-made wish!"},
    {k:["common entrance past","past question","entrance practice"], a:"<b>Primary 6</b> pupils practise Common Entrance questions inside the portal after login (<b>E-Learning</b>). Our pass rate is <b>100%</b>!"},
    {k:["about the school","about this school","tell me about","wetin","what is treasure","about treasure"], a:"<b>Treasure Academy, Ageva</b> is a Creche-to-Primary-6 school in Ageva, Okene — discipline, character and results since <b>2015</b>. Read our full story on the <b>About page</b>!"},
    {k:["all reviews","see all reviews","parent reviews","testimonials page"], a:"Tap <b>See All Reviews</b> under What Our Parents Say on the homepage — every approved parent review lives on the <b>Testimonials page</b>!"},
    {k:["pta meeting","when is pta","next meeting","attend meeting"], a:"PTA meeting dates are on the <b>PTA page</b> with a countdown — and you can tap <b>I Will Attend</b> so we can count you!"},
    {k:["call the school","school number","telephone"], a:"Tap the <b>Call School</b> button in the pupil portal, or call us during school hours: <b>Mon–Fri, 7:30am–3:00pm</b>."},
    {k:["search the site","find page","where is the page"], a:"Tap the <b>magnifier</b> in the top menu to <b>search</b> every page, news story and teacher on this website."},
    {k:["print","download page","save page"], a:"Most pages have a <b>Print</b> button — use it to save the page as a <b>PDF</b> or print it for your file."},
    {k:["school closed","is school open today","public holiday","rain"], a:"If school ever closes unexpectedly, a red <b>emergency banner</b> appears at the very top of every page. No banner means school is open!"},
    {k:["graduate list","class of","past pupils"], a:"Meet them on the <b>Graduates page</b> (linked from Alumni) — and read old-pupil stories on the <b>Alumni page</b>."},
    {k:["wish counter","how many wishes","birthday wishes"], a:"Every <b>Copy Wish</b> tap on the Birthdays page counts! Open the page to see how many wishes each celebrant has."},
    {k:["deadline","registration closing","closing date","last date"], a:"Watch the <b>Admissions page</b> deadline banner — it counts down the days left to complete registration."},
    {k:["exam reminder","remind me exam","study timetable"], a:"Exam dates are on the <b>Exam Timetable page</b> — and parents get an <b>exam reminder</b> from the school before papers begin."}
  ],
  placeholders: ["Ask about admissions...", "How do I check results?", "When does school open?", "What are the fees?", "Where is the school?", "How do I register?"],
  init(){
    if(document.getElementById("chatFab")) return;
    const fab = document.createElement("button");
    fab.id="chatFab"; fab.className="chat-fab"; fab.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12z"/><circle cx="8.5" cy="12" r="1.3" fill="#fff" stroke="none"/><circle cx="12.5" cy="12" r="1.3" fill="#fff" stroke="none"/><circle cx="16.5" cy="12" r="1.3" fill="#fff" stroke="none"/></svg><span class="ping"></span>'; fab.title="Chat with us";
    const panel = document.createElement("div");
    panel.className="chat-panel"; panel.id="chatPanel";
    panel.innerHTML=`<div class="chat-head"><div class="bot">TA</div><div><b>Treasure — School Assistant</b><small>Online • replies instantly</small></div><button class="x" id="chatClose">×</button></div>
      <div class="chat-msgs" id="chatMsgs"></div>
      <div class="chat-chips" id="chatChips"></div>
      <div class="chat-input"><input id="chatText" placeholder="Type your question..."><button id="chatSend" aria-label="Send"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 11.5l18-7-7 18-2.5-7.5z"/></svg></button></div>`;
    document.body.appendChild(fab); document.body.appendChild(panel);
    makeDraggable(fab);
    fab.onclick=()=>{ panel.classList.toggle("open"); if(panel.classList.contains("open") && !panel.dataset.hi){ panel.dataset.hi=1; this.botSay("Hello! I'm <b>Treasure</b>. Ask me anything about admissions, results, fees or contact."); } };
    document.getElementById("chatClose").onclick=()=>panel.classList.remove("open");
    ["Today at school","Fees","Lost & Found","News","Call school","Admit my child"].forEach(c=>{
      const b=document.createElement("button"); b.textContent=c;
      b.onclick=()=>{document.getElementById("chatText").value=c; this.send();};
      document.getElementById("chatChips").appendChild(b);
    });
    document.getElementById("chatSend").onclick=()=>this.send();
    document.getElementById("chatText").addEventListener("keydown",e=>{ if(e.key==="Enter") this.send(); });
    /* gentle rotating placeholder */
    const inp=document.getElementById("chatText"); let pi=0;
    setInterval(()=>{ if(document.activeElement!==inp) inp.placeholder=this.placeholders[pi=(pi+1)%this.placeholders.length]; }, 3200);
  },
  send(){
    const inp=document.getElementById("chatText"), v=inp.value.trim();
    if(!v) return; inp.value="";
    const box=document.getElementById("chatMsgs");
    box.insertAdjacentHTML("beforeend",`<div class="chat-msg me">${U.esc(v)}</div>`); box.scrollTop=box.scrollHeight;
    this.botSay(this.answer(v));
  },
  answer(q){
    const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
    const STOP={how:1,are:1,you:1,what:1,when:1,who:1,whom:1,is:1,do:1,does:1,did:1,i:1,my:1,me:1,the:1,a:1,an:1,to:1,of:1,for:1,and:1,in:1,on:1,at:1,it:1,this:1,that:1,with:1,please:1,pls:1,abeg:1,kindly:1,can:1,could:1,would:1,will:1,should:1,want:1,need:1,know:1,about:1,have:1,has:1,had:1,am:1,we:1,us:1,our:1,there:1,here:1,very:1,just:1,like:1,get:1,got:1};
    const SYN={sch:"school",skul:"school",skoo:"school",schl:"school",pix:"photo",pics:"photo",pic:"photo",foto:"photo",fotos:"photo",fone:"phone",num:"number",addr:"address",msg:"message",msgs:"message",xam:"exam",xams:"exams",tcher:"teacher",tchers:"teachers",stdnt:"student",pen:"pupil",admsn:"admission",reg:"register",hm:"headmistress",directionz:"direction",
    pikin:"child",pickin:"child",kiddies:"children",kids:"children",watin:"what",wetin:"what",abeg:"please",una:"you",dey:"is",wahala:"problem",money:"fees",charge:"fees",levy:"levy",mama:"mother",papa:"father",mummy:"mother",daddy:"father",kinde:"kind",skool:"school",result:"result",report:"result",scores:"result",marks:"result",grades:"result",schoolfees:"fees",tution:"fees",tuition:"fees",payment:"fees",hostel:"transport",lorry:"bus",danfo:"bus",okada:"transport",uniforms:"uniform",cloth:"uniform",clothes:"uniform",dress:"uniform",lesson:"classes",lessons:"classes",subject:"subjects",course:"subjects",hols:"holiday",vacation:"holiday",resumption:"resumption",reopen:"resumption",principal:"headmistress",proprietor:"owner",aunty:"teacher",uncle:"teacher",sir:"teacher",ma:"teacher",crèche:"creche",kindergarten:"nursery",kg:"nursery",basic:"primary",
    cost:"fees",price:"fees",prices:"fees",amount:"fees",bills:"fees",tomorrow:"tomorrow",yesterday:"yesterday",
    mornin:"morning",afternoon:"afternoon",evenin:"evening",nite:"night",week:"week",month:"month",term:"term",
    missin:"missing",forget:"missing",stole:"missing",claim:"claim",found:"found",lost:"lost",lose:"lost",los:"lost",loos:"lost",anythin:"anything",
    gate:"school",office:"office",compound:"school",classroom:"classes",examhall:"exams",reportcard:"result",
    proprietress:"owner",founder:"owner",managment:"owner",management:"owner",naira:"fees",kobo:"fees"};
    const stem=t=>{ if(t.length>4&&t.endsWith("ies"))return t.slice(0,-3)+"y"; if(t.length>4&&t.endsWith("es"))return t.slice(0,-2); if(t.length>3&&t.endsWith("s")&&!t.endsWith("ss"))return t.slice(0,-1); return t; };
    const lev=(a,b)=>{ const m=a.length,n=b.length; if(!m)return n; if(!n)return m; let d=[]; for(let i=0;i<=m;i++)d[i]=[i]; for(let j=1;j<=n;j++)d[0][j]=j; for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[m][n]; };
    const clean=norm(q);
    let toks=clean.split(" ").filter(t=>t&&!STOP[t]).map(t=>SYN[t]||t);
    toks=[...new Set(toks.flatMap(t=>[t,stem(t)]))];
    const joined=toks.join(" ");
    const has=(...ws)=>ws.some(w=>clean.includes(w)||toks.includes(w)||toks.includes(stem(w)));
    const hasTok=(...ws)=>ws.some(w=>toks.includes(w)||toks.includes(stem(w)));
    const hasPhrase=(...phs)=>phs.some(p=>clean.includes(p));
    let db={}; try{ db=DB.load(); }catch(e){}
    const F=this.liveFacts(db);
    const cls=this.classOf(clean);
    /* ----- greetings & courtesy ----- */
    if(/^(hi|hello|hey|good morning|good afternoon|good evening|how far|how are you)\b/.test(clean)){
      const warm=/how (far|are you)/.test(clean)?"I'm great, thanks for asking! ":"";
      return `${warm}Hello! I'm <b>Treasure</b>, the school assistant. The time is <b>${F.time}</b> — ask me about <b>fees</b>, <b>admissions</b>, <b>results</b>, <b>today's news</b>, <b>lost & found</b> or anything about the school!`;
    }
    if(has("thank")) return "You're most welcome! Anything else about the school — fees, dates, results, news?";
    if(hasPhrase("bye","goodbye","good night","see you")) return "Goodbye! Have a lovely day — Treasure Academy is always happy to help.";
    /* ----- school status / time / open / closed ----- */
    if(hasPhrase("what time","time is it","time now","open today","is school open","school closed","has closed","have closed","closing time","opening time","assembly","right now","school today","today at school","is there school","no school","when does school","school open","still open"))
      return F.status;
    /* ----- emergency / unexpected closure ----- */
    if(hasPhrase("public holiday","emergency","flood","rain","fire","closed today","not open"))
      return F.emergency;
    /* ----- lost & found ----- */
    if(has("lost","missing","missin","found","claim")&&!hasPhrase("fee claim","transfer claim","payment claim"))
      return F.lostfound;
    /* ----- uniform & shop prices ----- */
    if(has("uniform","shop","book","textbook","buy","cardigan","sportswear","shirt","skirt","shorts","sweater"))
      return F.shop+(has("fee","fees","price","cost","much","tuition")&&cls?("<br><br>"+F.feeFor(cls)):"");
    /* ----- receipt check ----- */
    if(has("receipt","verify","genuine","authentic","receipt number","confirm receipt"))
      return F.receipt;
    /* ----- fees ----- */
    if(has("fee","fees","price","cost","much","tuition","schoolfees","payment","pay","naira","charge","bills"))
      return (cls?F.feeFor(cls):F.fees)+"<br><br><span style='font-size:.85em'>All payments are by <b>bank transfer</b> to the school account — never cash to anyone.</span>";
    /* ----- news & events ----- */
    if(has("news","event","latest","happen","story","stories","excursion","party","graduation","video","photo","gallery","sport"))
      return F.news;
    /* ----- exams ----- */
    if(has("exam","exams","papers","timetable","common entrance","entrance")||hasTok("test","tests"))
      return F.exams;
    /* ----- PTA ----- */
    if(has("pta","meeting","attend"))
      return F.pta;
    /* ----- dates: resumption, deadline, holiday, next event ----- */
    if(has("resumption","resump","reopen","deadline","closing date","last date","holiday","vacation","calendar","session")||hasTok("when","date","term","week"))
      return F.dates;
    /* ----- staff ----- */
    if(has("teacher","teachers","staff","headmistress","principal","proprietor","owner","founder","tutor","nanny","driver")||hasTok("teach","guard"))
      return F.staff(cls);
    /* ----- contact ----- */
    if(has("call","phone","number","whatsapp","address","location","direction","email","visit","reach","contact","office"))
      return F.contact;
    /* ----- best student ----- */
    if(hasPhrase("best student","best pupil","overall best","best result","who won","who is the best","crowned","winner","champion"))
      return F.best;
    /* ----- top readers ----- */
    if(has("reader","readers","reading","leaderboard","bookworm","most books"))
      return F.readers;
    const scored=this.KB.map(e=>{
      let s=0;
      e.k.forEach(k=>{
        const nk=norm(k);
        if(!nk)return;
        if(clean.includes(nk)||joined.includes(nk)){ s+=3+nk.length*0.4; return; }
        nk.split(" ").forEach(w=>{
          if(STOP[w])return;
          toks.forEach(t=>{
            if(t===w||t===stem(w))s+=4;
            else if(t.length>=4&&w.length>=5){ const L=lev(t,w.length>6?w.slice(0,7):w); const lim=w.length>6?2:1; if(L<=lim)s+=2.5; }
          });
        });
      });
      return {e,s};
    }).sort((a,b)=>b.s-a.s);
    if(scored[0]&&scored[0].s>=1.5)return scored[0].e.a;
    const tops=scored.filter(x=>x.s>0).slice(0,3).map(x=>"<b>"+U.esc(x.e.k[0])+"</b>");
    return "Hmm, I didn't quite catch that."+(tops.length?(" Did you mean "+tops.join(", ")+"?"):"")
      +"<br>But I can answer live questions! Try: <b>Verify my receipt</b> • <b>Who is the best student?</b> • <b>Top readers</b> • <b>Is there school today?</b> • <b>How much is Primary 3 fees?</b> • <b>Any news today?</b> • <b>Did anyone lose anything?</b> • <b>When is resumption?</b> • <b>Who teaches Nursery 1?</b>";
  },
  classOf(s){
    s=String(s||"").toLowerCase();
    if(/creche|cr.che/.test(s))return "Creche";
    if(/pre.?nursery/.test(s))return "Pre-Nursery";
    if(/nursery\s*2|kg\s*2|kindergarten\s*2/.test(s))return "Nursery 2";
    if(/nursery|kg|kindergarten/.test(s))return "Nursery 1";
    const m=s.match(/(?:primary|pry|basic|grade|class)\s*([1-6])/)||s.match(/\b([1-6])\s*(?:primary|basic)\b/);
    if(m)return "Primary "+m[1];
    if(/common entrance|graduat/.test(s))return "Primary 6";
    return "";
  },
  liveFacts(db){
    const F={}, esc=U.esc, today=U.todayStr();
    const now=new Date(), dow=now.getDay();
    F.time=now.toLocaleTimeString("en-NG",{hour:"numeric",minute:"2-digit"});
    F.dayName=now.toLocaleDateString("en-NG",{weekday:"long"});
    let per=["",""]; try{ per=ClockWidget.schedule(now.getHours(),now.getMinutes(),dow); }catch(e){}
    const sch=db.school||{}, emg=sch.emergency||{};
    const open=!(dow===0||dow===6)&&!emg.on;
    const evs=(db.calendar||[]).filter(c=>c.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
    const exs=(db.exams||[]).filter(x=>x.date&&x.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
    const pta=(db.ptaMeetings||[]).filter(m=>m.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
    const news=(db.newsEvents||[]).filter(n=>!n.publishAt||n.publishAt<=today).sort((a,b)=>b.date.localeCompare(a.date));
    const lf=(db.lostfound||[]).filter(l=>!l.claimed&&!l.archived);
    const when=d=>{ const n=U.daysUntil(d); return n===0?"<b>today</b>":n===1?"<b>tomorrow</b>":"in <b>"+n+" days</b> ("+U.prettyDate(d)+")"; };
    /* status */
    F.status=emg.on
      ? `<b>School is closed:</b> ${esc(emg.text)}<br>The time is <b>${F.time}</b> (${F.dayName}).`
      : open
      ? `Yes — there is school today (${F.dayName}). The time is <b>${F.time}</b> and right now is <b>${esc(per[0])}</b>: ${esc(per[1])}<br>School hours: <b>Mon–Fri, 7:30am–3:00pm</b>.`
      : (dow===0||dow===6)
        ? `No school today — it's <b>${F.dayName}</b> (weekend). The time is <b>${F.time}</b>.<br>School resumes back on <b>Monday, 7:30am</b>.`
        : `The time is <b>${F.time}</b>. ${emg.on?("<b>School is closed:</b> "+esc(emg.text)):"School is not in session right now."}`;
    /* emergency */
    F.emergency=emg.on
      ? `<b>Yes — take note:</b> ${esc(emg.text)}<br>This red banner is showing at the top of every page until the headmistress removes it.`
      : `No emergency — school is running normally. If school ever closes unexpectedly, a red <b>emergency banner</b> appears at the very top of every page.`;
    /* lost & found */
    F.lostfound=lf.length
      ? `Yes — <b>${lf.length}</b> unclaimed item${lf.length===1?"":"s"} at the school office:<br>• `+lf.slice(0,4).map(l=>`<b>${esc(l.item)}</b> (found ${U.prettyDate(l.date)})`).join("<br>• ")
        +`<br>Open the <b>Lost & Found page</b> and tap <b>This is mine</b> — the office will call you.`
      : `Good news — <b>nothing is missing</b> right now! Every found item has been claimed. If your child loses something, check the <b>Lost & Found page</b>.`;
    /* fees */
    const fees=sch.fees||{};
    const CL=(typeof CLASSES!=="undefined"&&CLASSES.length?CLASSES:Object.keys(fees));
    const groups={}; CL.forEach(c=>{ if(fees[c]){ (groups[fees[c]]=groups[fees[c]]||[]).push(c); } });
    const feeLines=Object.keys(groups).sort((a,b)=>a-b).map(a=>`${groups[a].join(", ")}: <b>${U.naira(a)}</b>`);
    F.fees=(feeLines.length?("School fees <b>per term</b>:<br>• "+feeLines.join("<br>• ")):"Fee list is being updated — ask the school office.")
      +((db.ptaLevy||{}).amount?(`<br>PTA levy: <b>${U.naira(db.ptaLevy.amount)}</b> per family.`):"");
    F.feeFor=c=>fees[c]
      ? `<b>${esc(c)}</b> fees: <b>${U.naira(fees[c])}</b> per term${(db.ptaLevy||{}).amount?(` + PTA levy <b>${U.naira(db.ptaLevy.amount)}</b> per family`):""}.`
      : `I don't have the <b>${esc(c)}</b> fee yet — message the school on the <b>Contact page</b> for the current amount.`;
    /* shop & uniform */
    const uni=(db.uniform||[]).slice(0,6).map(u=>`${esc(u.name)}: <b>${U.naira(u.price)}</b>`);
    const shp=(db.shopItems||[]).slice(0,6).map(u=>`${esc(u.name)}: <b>${U.naira(u.price)}</b>`);
    F.shop=(uni.length?("Uniform prices:<br>• "+uni.join("<br>• ")+(db.uniform.length>6?"<br>…see the <b>Uniform page</b> for the full list.":"")):"")
      +(shp.length?("<br><br>Shop items:<br>• "+shp.join("<br>• ")+(db.shopItems.length>6?"<br>…see the <b>Shop page</b> for everything.":"")):"")
      ||"Price list is being updated — check the <b>Uniform</b> and <b>Shop</b> pages.";
    /* news */
    const td=news.filter(n=>n.date===today);
    F.news=(td.length?(`<b>Today (${U.prettyDate(today)}):</b><br>• `+td.map(n=>`(${(n.type||"news").toUpperCase()}) <b>${esc(n.title)}</b>`).join("<br>• ")+"<br><br>"):"")
      +(news.length?("Latest stories:<br>• "+news.slice(0,3).map(n=>`<b>${esc(n.title)}</b> — ${U.prettyDate(n.date)}`).join("<br>• ")+"<br>Read them all on the <b>News page</b>."):"No stories yet — check back soon!");
    /* exams */
    F.exams=exs.length
      ? (`Next exams:<br>• `+exs.slice(0,3).map(x=>`<b>${esc(x.subject)}</b> ${when(x.date)}${x.time?(" at "+esc(x.time)):""}`).join("<br>• ")+`<br>Full timetable is on the <b>Exam Timetable page</b>.`)
      : `No exams scheduled yet — the timetable will appear on the <b>Exam Timetable page</b>.`;
    /* pta */
    F.pta=pta.length
      ? (`Next PTA meeting: <b>${esc(pta[0].title)}</b> ${when(pta[0].date)}${pta[0].venue?(" at "+esc(pta[0].venue)):""}.<br>Open the <b>PTA page</b> and tap <b>I Will Attend</b> so we can count you!`)
      : `No PTA meeting scheduled yet — check the <b>PTA page</b> soon.`;
    /* dates */
    const res=evs.find(c=>/resump/i.test(c.title||""));
    let dl="";
    if(res){ const d=new Date(res.date+"T12:00:00"); d.setDate(d.getDate()+14); const ds=d.toISOString().slice(0,10), n=U.daysUntil(ds);
      dl=`<br>Admission deadline: <b>${U.prettyDate(ds)}</b> (${n<0?"closed":n===0?"closes today":n+" days left"}).`; }
    F.dates=(res?(`Resumption: <b>${esc(res.title)}</b> ${when(res.date)}.`):(evs.length?(`Next on the calendar: <b>${esc(evs[0].title)}</b> ${when(evs[0].date)}.`):`Term dates are being updated.`))+dl
      +`<br>See every date on the <b>Calendar page</b>. Current: <b>${esc(sch.term||"")}</b>, ${esc(sch.session||"")}.`;
    /* staff */
    F.staff=c=>{
      const ts=db.teachers||[];
      if(c){ const t=ts.find(x=>String(x.class||"").toLowerCase()===c.toLowerCase());
        return t?`<b>${esc(t.name)}</b> teaches <b>${esc(c)}</b>.`:`I don't have the <b>${esc(c)}</b> class teacher yet — ask the school office.`; }
      return `Our headmistress is <b>${esc(sch.headName||"the headmistress")}</b>. We have <b>${ts.length}</b> staff.`+(ts.length?("<br>• "+ts.slice(0,6).map(t=>`<b>${esc(t.name)}</b> — ${esc(t.class||"Staff")}`).join("<br>• ")+(ts.length>6?"<br>…meet everyone on the <b>About</b> and <b>Staff</b> pages.":"")):"");
    };
    /* contact */
    const wa=(db.whatsapp||[]).filter(w=>w.active!==false)[0];
    F.contact=`Call or chat with us:<br>• Phone: <b>${esc(sch.phone||"—")}</b><br>• WhatsApp: <b>${wa?("0"+String(wa.phone||"").replace(/^234/,"")):"—"}</b><br>• Email: <b>${esc(sch.email||"—")}</b><br>• Address: ${esc(sch.address||"Ageva, Okene")}<br>• Hours: <b>Mon–Fri, 7:30am–3:00pm</b><br>Open the <b>Contact page</b> for the map and directions.`;
    /* receipt check */
    F.receipt=`Got a school-fee or PTA receipt? Open the <b>Admissions page</b>, scroll to <b>Verify a Receipt</b>, and type the receipt number (e.g. TA/2026/0001). Genuine receipts show the pupil's name and amount — fakes show <b>NOT FOUND</b>.`;
    /* best student */
    const bs=db.bestStudent||{};
    F.best=bs.published&&bs.name
      ? `Our <b>Best Student of the Session</b> is <b>${esc(bs.name)}</b> (${esc(bs.class||"")}) with <b>${bs.score}/100</b> — scored from attendance, fees, parent review, textbooks and results. See the crown on the <b>home page</b>!`
      : `The <b>Best Student of the Session</b> has not been crowned yet. It is scored from attendance, fees paid, parent reviews, textbooks and results — check back soon!`;
    /* top readers */
    const rt=[...(db.readTop||[])].sort((a,b)=>(b.books||0)-(a.books||0)).slice(0,3);
    F.readers=rt.length
      ? (`Our top readers:<br>• `+rt.map((r,i)=>`<b>#${i+1} ${esc(r.name)}</b> (${esc(r.class||"")}) — ${r.books||0} book(s)`).join("<br>• ")+`<br>See the full top 10 on the <b>Reading page</b> — and log the books your child finishes!`)
      : `No readers on the board yet — open the <b>Reading page</b> and log the first book your child finishes!`;
    return F;
  },
  botSay(html){
    const box=document.getElementById("chatMsgs");
    const d=document.createElement("div"); d.className="chat-msg bot";
    d.innerHTML='<span class="typing-dots"><i></i><i></i><i></i></span>';
    box.appendChild(d); box.scrollTop=box.scrollHeight;
    setTimeout(()=>{
      const tmp=document.createElement("div"); tmp.innerHTML=html;
      const words=tmp.textContent.split(/(\s+)/);
      d.innerHTML='<span class="ttxt"></span><span class="tcaret"></span>';
      const t=d.querySelector(".ttxt"); let i=0;
      const tick=()=>{ if(i<words.length){ t.textContent+=words[i++]; box.scrollTop=box.scrollHeight; setTimeout(tick,24); }
        else { d.innerHTML=html; box.scrollTop=box.scrollHeight; } };
      tick();
    }, 700);
  }
};

/* ---------------- ANALOG CLOCK + timetable ---------------- */
const ClockWidget = {
  schedule(h, m, day){
    if(day===0||day===6) return ["WEEKEND","Weekend — school resumes back on Monday."];
    const t = h + m/60;
    if(t>=7 && t<7.75)  return ["OPENING TIME","School is now open."];
    if(t>=7.75 && t<8)  return ["ASSEMBLY TIME","Morning assembly in progress."];
    if(t>=8 && t<10)    return ["STUDY TIME","Classes are in session."];
    if(t>=10 && t<10.5) return ["BREAK TIME","Short break in progress."];
    if(t>=10.5 && t<15) return ["STUDY TIME","Classes are in session."];
    if(t>=15 && t<24)   return ["CLOSING TIME","School has closed for the day."];
    return ["SCHOOL CLOSED","Reopens at 7:00am."];
  },
  init(){
    if(document.getElementById("clockWidget")) return;
    const w=document.createElement("div");
    w.className="clock-widget"; w.id="clockWidget";
    w.innerHTML=`<button class="clock-toggle" id="clockToggle">–</button>
      <div class="clock-body"><canvas id="clockFace" width="120" height="120"></canvas>
      <div class="clock-time" id="clockTime"></div><div class="clock-status" id="clockStatus"></div></div>
      <div id="clockMini" style="display:none;font-weight:700"><span id="clockMiniT"></span></div>`;
    document.body.appendChild(w);
    makeDraggable(w);
    document.getElementById("clockToggle").onclick=(e)=>{ e.stopPropagation();
      const min=w.classList.toggle("min");
      document.querySelector("#clockWidget .clock-body").style.display=min?"none":"block";
      document.getElementById("clockMini").style.display=min?"block":"none";
    };
    const autoMin=()=>{ w.classList.add("min"); document.querySelector("#clockWidget .clock-body").style.display="none"; document.getElementById("clockMini").style.display="block"; };
    let seenClock=0; try{ seenClock=sessionStorage.getItem("ta_clock_seen"); }catch(e){}
    if(seenClock){ autoMin(); }
    else { setTimeout(()=>{ autoMin(); try{ sessionStorage.setItem("ta_clock_seen","1"); }catch(e){} }, 5000); }
    const cv=document.getElementById("clockFace"), ctx=cv.getContext("2d");
    const draw=()=>{
      const now=new Date(), h=now.getHours(), m=now.getMinutes(), s=now.getSeconds()+now.getMilliseconds()/1000;
      const dark=document.documentElement.dataset.theme==="dark";
      ctx.clearRect(0,0,120,120);
      ctx.save(); ctx.translate(60,60);
      ctx.beginPath(); ctx.arc(0,0,55,0,7); ctx.fillStyle=dark?"#0F1722":"#F7F9FB"; ctx.fill();
      ctx.lineWidth=3.5; ctx.strokeStyle="#C9A227"; ctx.stroke();
      for(let n=0;n<12;n++){ const a=n*Math.PI/6;
        ctx.beginPath(); ctx.arc(Math.cos(a)*45,Math.sin(a)*45,n%3===0?3.4:1.8,0,7);
        ctx.fillStyle=n%3===0?(dark?"#C9A227":"#0E3B21"):(dark?"#9AA7B8":"#5D6B7D"); ctx.fill(); }
      const hand=(ang,len,wd,col)=>{ ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0,5); ctx.lineTo(0,-len);
        ctx.lineWidth=wd; ctx.lineCap="round"; ctx.strokeStyle=col; ctx.stroke(); ctx.restore(); };
      hand(((h%12)+m/60)*Math.PI/6, 27, 5, dark?"#EAF0F6":"#203040");
      hand((m+s/60)*Math.PI/30, 40, 3.4, dark?"#EAF0F6":"#1F2A5B");
      hand(s*Math.PI/30, 43, 1.6, "#C9A227");
      ctx.beginPath(); ctx.arc(0,0,4,0,7); ctx.fillStyle="#C9A227"; ctx.fill();
      ctx.restore();
      const tstr=now.toLocaleTimeString("en-NG",{hour:"numeric",minute:"2-digit",second:"2-digit"});
      document.getElementById("clockTime").textContent=tstr;
      document.getElementById("clockMiniT").textContent=tstr;
      const [title,sub]=this.schedule(h,m,now.getDay());
      document.getElementById("clockStatus").innerHTML=`<b>${title}</b><br>${sub}`;
    }; draw(); setInterval(draw,250);
  }
};

/* ---------------- TREASURE CAPTCHA ---------------- */
const Treasure = {
  makers: [
    ()=>{
      const words=[["A","Apple"],["B","Ball"],["C","Cat"],["D","Dog"],["E","Egg"],["F","Fish"]];
      const pick=[...words].sort(()=>Math.random()-.5).slice(0,3);
      const target=pick[Math.floor(Math.random()*3)];
      return {q:`Select the word that starts with the letter <b>${target[0]}</b>`, opts:pick.map(p=>({v:p[0],h:`<span style="font-size:1.15rem;font-weight:800">${p[1]}</span>`})), ans:target[0]};
    },
    ()=>{
      const L="ABCDEFGHIJ"; const i=Math.floor(Math.random()*7);
      const ans=L[i+2];
      const opts=[...new Set([ans,L[Math.floor(Math.random()*10)],L[Math.floor(Math.random()*10)]])].slice(0,3).sort(()=>Math.random()-.5);
      return {q:`Which letter comes after <b>${L[i]} ${L[i+1]}</b>?`, opts:opts.map(o=>({v:o,h:`<span style="font-size:1.7rem;font-weight:800">${o}</span>`})), ans};
    },
    ()=>{
      const L="ABCDEFGH"; const ans=L[Math.floor(Math.random()*8)];
      const opts=[...new Set([ans,L[Math.floor(Math.random()*8)],L[Math.floor(Math.random()*8)]])].slice(0,3).sort(()=>Math.random()-.5);
      return {q:`Select the letter <b style="font-size:1.7rem">${ans}</b>`, opts:opts.map(o=>({v:o,h:`<span style="font-size:1.7rem;font-weight:800">${o}</span>`})), ans};
    },
    ()=>{
      const n=2+Math.floor(Math.random()*4);
      const opts=[...new Set([String(n),String(n+1),String(Math.max(1,n-1))])].sort(()=>Math.random()-.5);
      return {q:`How many stars do you see?<br><span style="font-size:1.6rem;letter-spacing:3px;color:#D9A41F">`+"★".repeat(n)+`</span>`, opts:opts.map(o=>({v:o,h:`<span style="font-size:1.5rem;font-weight:800">${o}</span>`})), ans:String(n)};
    },
    ()=>{ /* tap ALL the school things */
      const good=["Book","Pencil","School Bag"], bad=["Fish","Cat","Ball"];
      const opts=[...good.map(g=>({v:g,good:1})),...bad.map(b=>({v:b,good:0}))].sort(()=>Math.random()-.5);
      return {q:`Tap <b>ALL</b> the school things (then press Verify)`, multi:true,
        opts:opts.map(o=>({v:o.v,h:`<span style="font-size:1rem;font-weight:800">${o.v}</span>`})), ans:good};
    },
    ()=>{ /* word -> first letter (letter-word match) */
      const pairs=[["A","Apple"],["B","Ball"],["C","Cat"],["D","Dog"],["E","Egg"],["F","Fish"],["G","Goat"],["H","Hen"]];
      const t=pairs[Math.floor(Math.random()*pairs.length)];
      const letters=[...new Set([t[0],pairs[Math.floor(Math.random()*8)][0],pairs[Math.floor(Math.random()*8)][0]])].slice(0,3).sort(()=>Math.random()-.5);
      return {q:`Match the word to its first letter: <b style="font-size:1.5rem">${t[1]}</b> starts with…`, opts:letters.map(o=>({v:o,h:`<span style="font-size:1.7rem;font-weight:800">${o}</span>`})), ans:t[0]};
    },
    ()=>{ /* education question bank */
      const bank=()=>{
        const r=Math.random();
        if(r<0.4){ const a=1+Math.floor(Math.random()*5),b=1+Math.floor(Math.random()*4);
          const ans=String(a+b);
          return {q:`Solve like a pupil: <b style="font-size:1.5rem">${a} + ${b} = ?</b>`,opts:[ans,String(a+b+1),String(Math.max(1,a+b-1))].sort(()=>Math.random()-.5).map(o=>({v:o,h:`<span style="font-size:1.5rem;font-weight:800">${o}</span>`})),ans}; }
        if(r<0.7){ const i=Math.floor(Math.random()*3), ans=["Tue","Wed","Thu","Fri"][i];
          const opts=[...new Set([ans,"Mon","Fri","Sun"])].slice(0,3).sort(()=>Math.random()-.5);
          return {q:`School days: which day comes after <b>${["Mon","Tue","Wed"][i]}</b>?`,opts:opts.map(o=>({v:o,h:`<span style="font-size:1.2rem;font-weight:800">${o}</span>`})),ans}; }
        const cls=["Creche","Nursery 1","Primary 3","Primary 6"], ans=cls[Math.floor(Math.random()*4)];
        const opts=[...new Set([ans,"University","Secondary School"])].slice(0,3).sort(()=>Math.random()-.5);
        return {q:`Which one is a class in <b>our school</b>?`,opts:opts.map(o=>({v:o,h:`<span style="font-size:1rem;font-weight:800">${o}</span>`})),ans};
      };
      return bank();
    }
  ],
  open(onPass){
    const old=document.getElementById("treasureModal"); if(old) old.remove();
    const c=this.makers[Math.floor(Math.random()*this.makers.length)]();
    const m=document.createElement("div");
    m.className="modal-bg show"; m.id="treasureModal";
    m.innerHTML=`<div class="modal" style="max-width:430px;text-align:center">
      <h2>Security Check</h2>
      <p style="color:var(--muted);font-size:.87rem">Please confirm you are human</p>
      <div id="humanStep1" style="margin:18px 0">
        <label style="display:flex;gap:12px;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:12px;padding:14px;cursor:pointer;font-weight:700">
          <input type="checkbox" id="humanBox" style="width:22px;height:22px;accent-color:#177A3F"> I'm not a robot
        </label>
        <button class="btn btn-mint btn-sm" id="humanGo" disabled style="margin-top:14px;opacity:.5">Continue</button>
      </div>
      <div id="humanStep2" style="display:none">
        <div class="notice" style="text-align:center;display:block;margin:16px 0"><b>${c.q}</b></div>
        <div style="display:flex;gap:10px;justify-content:center" id="treasureOpts">
          ${c.opts.map(o=>`<button class="icon-btn" style="padding:12px 20px;font-size:1rem" data-v="${o.v}">${o.h}</button>`).join("")}
        </div>
        <button class="link-btn" style="margin-top:14px" id="treasureNew">Try a different one</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    const box=m.querySelector("#humanBox"), go=m.querySelector("#humanGo");
    box.onchange=()=>{ go.disabled=!box.checked; go.style.opacity=box.checked?"1":".5"; };
    go.onclick=()=>{ m.querySelector("#humanStep1").style.display="none"; m.querySelector("#humanStep2").style.display=""; };
    if(c.multi){
      const picked=new Set();
      m.querySelector("#treasureOpts").insertAdjacentHTML("afterend",'<button class="btn btn-mint btn-sm" id="treasureVerify" style="margin-top:14px">Verify</button>');
      m.querySelectorAll("#treasureOpts button").forEach(b=>b.onclick=()=>{
        if(picked.has(b.dataset.v)){picked.delete(b.dataset.v);b.classList.remove("picked");b.style.outline="";}
        else{picked.add(b.dataset.v);b.classList.add("picked");b.style.outline="3px solid #177A3F";}
      });
      m.querySelector("#treasureVerify").onclick=()=>{
        const ok=c.ans.length===picked.size&&c.ans.every(v=>picked.has(v));
        if(ok){ m.remove(); U.toast("Verified. Thank you!"); onPass&&onPass(); }
        else U.toast("Not quite — tap ALL the school things, then Verify.");
      };
    } else m.querySelectorAll("#treasureOpts button").forEach(b=>b.onclick=()=>{
      if(b.dataset.v===c.ans){ m.remove(); U.toast("Verified. Thank you!"); onPass&&onPass(); }
      else{ b.classList.add("shake"); setTimeout(()=>b.classList.remove("shake"),500); U.toast("Not quite — try again."); }
    });
    m.querySelector("#treasureNew").onclick=()=>{ m.remove(); this.open(onPass); };
  }
};

/* ---------- week-at-a-glance strip (headmistress controlled) ---------- */
function renderWeekStrip(){
  const box=document.getElementById("weekStrip");
  if(!box||box.dataset.done)return; box.dataset.done=1;
  let db={}; try{ db=DB.load(); }catch(e){}
  const ws=db.weekStrip||{on:true};
  if(ws.on===false){ box.innerHTML=""; return; }
  const today=U.todayStr(), d7=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  const items=[];
  (db.calendar||[]).filter(c=>c.date>=today&&c.date<=d7).slice(0,2).forEach(c=>items.push({d:c.date,t:c.title,u:"calendar.html"}));
  (db.exams||[]).filter(x=>x.date&&x.date>=today&&x.date<=d7).slice(0,1).forEach(x=>items.push({d:x.date,t:"Exams: "+x.subject+" ("+x.time+")",u:"exams.html"}));
  (db.ptaMeetings||[]).filter(m=>m.date>=today&&m.date<=d7).slice(0,1).forEach(m=>items.push({d:m.date,t:"PTA: "+m.title,u:"pta.html"}));
  items.sort((a,b)=>a.d.localeCompare(b.d));
  box.innerHTML=`<div class="week-strip clip-up"><span class="sec-tag">This Week</span>
    <div class="week-items">${items.length?items.map(i=>`<a class="week-item" href="${i.u}"><b>${U.shortDate(i.d)}</b><span>${U.esc(i.t)}</span></a>`).join(""):'<span class="week-none">A calm week — no events scheduled.</span>'}</div>
    ${ws.note?`<p class="week-note">${U.esc(ws.note)}</p>`:""}</div>`;
}
/* ---------- offline support (service worker, works after launch too) ---------- */
function registerSW(){
  if(!("serviceWorker" in navigator))return;
  if(!/^https?:$/.test(location.protocol))return;
  const base=(document.body.dataset.assets||"assets/").replace(/assets\/$/,"");
  navigator.serviceWorker.register(base+"sw.js").catch(()=>{});
}
/* ---------- motto ribbon ---------- */
function renderMotto(){
  const nav=document.querySelector(".navbar");
  if(!nav||document.getElementById("mottoRibbon"))return;
  const s=(DB.load().school||{});
  nav.insertAdjacentHTML("afterend",`<div class="motto-ribbon" id="mottoRibbon"><span>\u201C${U.esc(s.motto||"Our God is able")}\u201D</span></div>`);
}
/* ---------- breaking-news ticker ---------- */
function renderTicker(){
  if(document.getElementById("newsTicker"))return;
  let db={}; try{ db=DB.load(); }catch(e){}
  const t=db.ticker||{};
  if(!t.on)return;
  const items=[];
  if(t.on&&t.text)items.push(t.text);
  const today=U.todayStr();
  (db.newsEvents||[]).filter(n=>n.date===today&&(!n.publishAt||n.publishAt<=today)).forEach(n=>items.push(((n.type==="event")?"Event today: ":"News today: ")+n.title+" ("+n.date+")"));
  (db.lostfound||[]).filter(l=>!l.claimed).slice(0,4).forEach(l=>items.push("Lost & Found: "+l.item+" — found "+(l.date||"recently")+". Is it yours?"));
  if(!items.length)return;
  const anchor=document.getElementById("mottoRibbon")||document.querySelector(".navbar");
  if(!anchor)return;
  const html=items.map(x=>`<span>${U.esc(x)}</span>`).join('<span class="tick-sep">•</span>');
  anchor.insertAdjacentHTML("afterend",`<div class="ticker" id="newsTicker" role="marquee" aria-label="School announcements"><div class="ticker-inner">${html}<span class="tick-sep">•</span><span aria-hidden="true">${html}</span></div></div>`);
}
/* ---------- staff birthday bell (homepage) ---------- */
function renderBday(){
  const box=document.getElementById("bdayBell");
  if(!box||box.dataset.done)return; box.dataset.done=1;
  let db={}; try{ db=DB.load(); }catch(e){}
  const md=(d)=>String(d||"").slice(5);
  const today=U.todayStr().slice(5);
  const names=(db.teachers||[]).filter(t=>md(t.dob)===today).map(t=>t.name);
  if(db.school&&md(db.school.headDob)===today)names.unshift((db.school.headName||"Headmistress")+" (Headmistress)");
  if(!names.length)return;
  box.innerHTML=`<div class="bday-bell clip-up"><b>Happy Birthday!</b> Today we celebrate ${names.map(n=>`<b>${U.esc(n)}</b>`).join(" & ")} - with love from the whole Treasure Academy family. <a href="birthdays.html">Send a wish</a></div>`;
}
function renderBdayCount(){
  const box=document.getElementById("bdayCount");
  if(!box||box.dataset.done)return; box.dataset.done=1;
  let db={}; try{ db=DB.load(); }catch(e){}
  const list=[];
  (db.teachers||[]).forEach(t=>{ if(t.dob)list.push({name:t.name,dob:t.dob,role:"Staff"}); });
  if(db.school&&db.school.headDob)list.push({name:db.school.headName||"Headmistress",dob:db.school.headDob,role:"Headmistress"});
  if(!list.length)return;
  const now=new Date(U.todayStr()+"T12:00:00");
  let best=null,bestDd=366;
  list.forEach(p=>{
    const md=String(p.dob||"").slice(5); if(md.length!==5)return;
    let nx=new Date(now.getFullYear()+"-"+md+"T12:00:00");
    let dd=Math.round((nx-now)/864e5);
    if(dd<0){ nx=new Date((now.getFullYear()+1)+"-"+md+"T12:00:00"); dd=Math.round((nx-now)/864e5); }
    if(dd===0)return;
    if(dd<bestDd){bestDd=dd;best=p;}
  });
  if(!best)return;
  const when=bestDd===1?"Tomorrow!":("in "+bestDd+" days");
  box.innerHTML=`<a class="count-bar" href="birthdays.html"><span class="count-num">${bestDd}</span><span>${U.icon("gift",18)} Next birthday: <b>${U.esc(best.name)}</b> (${U.esc(best.role)}) — ${when}</span><span style="margin-left:auto">→</span></a>`;
}
/* ---------- emergency banner (headmistress one-switch alert) ---------- */
function renderEmergency(){
  if(document.getElementById("emgBanner"))return;
  let e={}; try{ e=DB.load().school.emergency||{}; }catch(err){}
  if(!e.on||!e.text)return;
  const top=document.body.firstElementChild;
  const d=document.createElement("div");
  d.className="emg-banner"; d.id="emgBanner";
  d.innerHTML=`<span class="emg-dot"></span><span>${U.esc(e.text)}</span>`;
  document.body.insertBefore(d,top);
}

/* ---------------- LOADER (school crest splash) ---------------- */
(function(){
  if(!document.querySelector('link[href*="corporate"]'))return;
  const base=(document.body.dataset&&document.body.dataset.assets)||(location.pathname.indexOf("/portal/")>=0?"../assets/":"assets/");
  let l=document.getElementById("siteLoader");
  if(!l){
    l=document.createElement("div"); l.id="siteLoader";
    const im=document.createElement("img"); im.src=base+"img/logo.jpg"; im.alt="Treasure Academy";
    const sp=document.createElement("div"); sp.className="spin";
    l.appendChild(im); l.appendChild(sp); document.body.appendChild(l);
  }else{
    if(!l.querySelector("img")){ const im=document.createElement("img"); im.src=base+"img/logo.jpg"; im.alt="Treasure Academy"; l.prepend(im); }
    if(!l.querySelector(".spin")){ const sp=document.createElement("div"); sp.className="spin"; l.appendChild(sp); }
  }
  let gone=false; const hide=()=>{ if(gone)return; gone=true; l.classList.add("done"); setTimeout(()=>l.remove(),500); };
  window.addEventListener("load",()=>setTimeout(hide,350)); setTimeout(hide,3500);
})();

/* ---------------- LIGHTBOX (photo viewer) ---------------- */
const Lightbox = {
  items: [], i: 0, key: null,
  open(items, idx){
    this.items = items || []; this.i = this.items.length ? Math.max(0, Math.min(idx || 0, this.items.length - 1)) : 0;
    if(!this.items.length) return;
    const old = document.getElementById("lightbox"); if(old) old.remove();
    const m = document.createElement("div"); m.id = "lightbox"; m.className = "lightbox";
    m.innerHTML = `<div class="lb-box">
        <button class="lb-x" aria-label="Close">×</button>
        <button class="lb-arrow lb-prev" aria-label="Previous">‹</button>
        <img class="lb-img" src="" alt="photo">
        <button class="lb-arrow lb-next" aria-label="Next">›</button>
        <div class="lb-cap"></div>
        <div class="lb-bar"><span class="lb-count"></span><span class="lb-btns"></span></div>
      </div>`;
    document.body.appendChild(m);
    m.querySelector(".lb-x").onclick = () => this.close();
    m.querySelector(".lb-prev").onclick = e => { e.stopPropagation(); this.go(-1); };
    m.querySelector(".lb-next").onclick = e => { e.stopPropagation(); this.go(1); };
    m.addEventListener("click", e => { if(e.target.id === "lightbox" || e.target.classList.contains("lb-box")) this.close(); });
    this.key = e => { if(e.key === "Escape") this.close(); if(e.key === "ArrowLeft") this.go(-1); if(e.key === "ArrowRight") this.go(1); };
    document.addEventListener("keydown", this.key);
    let sx = null;
    m.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
    m.addEventListener("touchend", e => { if(sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if(Math.abs(dx) > 40) this.go(dx < 0 ? 1 : -1); }, { passive: true });
    this.paint();
  },
  go(d){ this.i = (this.i + d + this.items.length) % this.items.length; this.paint(); },
  paint(){
    const m = document.getElementById("lightbox"); if(!m) return;
    const it = this.items[this.i];
    m.querySelector(".lb-img").src = it.src;
    m.querySelector(".lb-cap").textContent = it.cap || "";
    const lc=m.querySelector(".lb-count"); if(lc)lc.remove();
    const btns = m.querySelector(".lb-btns"); btns.innerHTML = "";
    if(it.storyId){ const a = document.createElement("a"); a.className = "btn btn-white btn-sm"; a.href = "story.html?id=" + it.storyId; a.textContent = "Full story"; btns.appendChild(a); }
    const dl = document.createElement("button"); dl.className = "btn btn-mint btn-sm"; dl.textContent = "Download";
    dl.onclick = () => U.downloadFile(it.src, String(it.src).split("/").pop());
    btns.appendChild(dl);
  },
  close(){ const m = document.getElementById("lightbox"); if(m) m.remove(); if(this.key){ document.removeEventListener("keydown", this.key); this.key = null; } }
};

/* ---------------- STARS + FIREFLIES (dark-mode sky) ---------------- */
const Stars = {
  init(){
    if(document.getElementById("starCanvas")) return;
    const cv=document.createElement("canvas"); cv.id="starCanvas";
    document.body.appendChild(cv);
    const ctx=cv.getContext("2d");
    let W,H,stars=[],flies=[];
    const size=()=>{ W=cv.width=innerWidth; H=cv.height=innerHeight;
      stars=Array.from({length:Math.min(90,Math.floor(W/14))},()=>({x:Math.random()*W,y:Math.random()*H,r:.6+Math.random()*1.5,p:Math.random()*6.28,s:.5+Math.random()*1.5}));
      flies=Array.from({length:18},()=>({x:Math.random()*W,y:Math.random()*H,vx:.15+Math.random()*.35,vy:.1+Math.random()*.3,r:1.4+Math.random()*1.5,p:Math.random()*6.28,q:Math.random()*6.28}));
    };
    size(); addEventListener("resize",size);
    (function loop(){
      requestAnimationFrame(loop);
      if(document.documentElement.dataset.theme!=="dark"||document.hidden) return;
      ctx.clearRect(0,0,W,H);
      const t=Date.now()/1000;
      stars.forEach(s=>{ const a=.25+.55*Math.abs(Math.sin(t*s.s+s.p));
        ctx.globalAlpha=a; ctx.fillStyle="#CFE3FF"; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,7); ctx.fill(); });
      flies.forEach(f=>{ f.x+=f.vx; if(f.x>W+12)f.x=-12;
        const fy=(f.y+t*9*f.vy)%(H+24)-12;
        const g=.5+.5*Math.sin(t*2+f.p), tw=.55+.45*Math.sin(t*3.2+f.q);
        ctx.globalAlpha=Math.min(1,(.2+.6*g)*tw+.18); ctx.fillStyle="#FFE9A3"; ctx.shadowColor="#FFD94D"; ctx.shadowBlur=14*g+4;
        ctx.beginPath(); ctx.arc(f.x,fy,f.r,0,7); ctx.fill(); ctx.shadowBlur=0; });
      ctx.globalAlpha=1;
    })();
  }
};

/* ---------------- INPUT FILTERS (letters-only / numbers-only) ---------------- */
function initInputFilters(scope){
  (scope||document).querySelectorAll("[data-alpha]").forEach(i=>{ if(i.dataset.fbound)return; i.dataset.fbound=1;
    i.addEventListener("input",()=>{ i.value=i.value.replace(/[^a-zA-Z\s'.-]/g,""); }); });
  (scope||document).querySelectorAll("[data-num]").forEach(i=>{ if(i.dataset.fbound)return; i.dataset.fbound=1;
    i.addEventListener("input",()=>{ i.value=i.value.replace(/\D/g,""); }); });
  (scope||document).querySelectorAll("[data-phone]").forEach(i=>{ if(i.dataset.fbound)return; i.dataset.fbound=1;
    i.setAttribute("maxlength","11"); i.setAttribute("inputmode","numeric");
    const norm=()=>{ let v=i.value.replace(/\D/g,""); if(v.length===11&&v[0]==="0")v=v.slice(1); if(v.length>10)v=v.slice(-10); i.value=v; };
    i.addEventListener("input",norm); i.addEventListener("blur",norm); });
  (scope||document).querySelectorAll("[data-alpha]").forEach(i=>{ if(i.dataset.cbound)return; i.dataset.cbound=1;
    i.addEventListener("blur",()=>{ i.value=i.value.replace(/\s+/g," ").replace(/(^|\s|['-])([a-z])/g,(m,p,c)=>p+c.toUpperCase()); }); });
}

/* ---------------- boot (each step isolated; widgets guaranteed) ---------------- */
function bootSafe(fn){ try{ fn(); }catch(e){ if(window.console&&console.warn) console.warn("boot step skipped:", e&&e.message); } }
function bootWidgets(){
  if(document.body.dataset.widgets==="off") return;
  bootSafe(()=>Chatbot.init());
  bootSafe(()=>ClockWidget.init());
  bootSafe(()=>Stars.init());
}
document.addEventListener("DOMContentLoaded", ()=>{
  bootSafe(()=>Theme.init());
  bootSafe(()=>Search.init());
  bootSafe(()=>injectSchool());
  const pg = Site.page;
  bootSafe(()=>renderNav(pg));
  bootSafe(()=>renderFooter());
  bootSafe(()=>renderMotto());
  bootSafe(()=>renderTicker());
  bootSafe(()=>renderBday());
  bootSafe(()=>renderBdayCount());
  bootSafe(()=>renderEmergency());
  bootSafe(()=>renderWeekStrip());
  bootSafe(()=>registerSW());
  bootSafe(()=>initTopBtn());
  bootSafe(()=>initSliders());
  bootSafe(()=>initReveal());
  bootSafe(()=>typeLabels(document));
  bootSafe(()=>initInputFilters(document));
  bootWidgets();
  setTimeout(bootWidgets, 1500);
});
setTimeout(bootWidgets, 3000);
