const {chromium}=require('playwright');
const assert=require('assert');
(async()=>{const browser=await chromium.launch({headless:true});let passed=0;
async function check(width){
 const page=await browser.newPage({viewport:{width,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/.test(m.text()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
 await page.waitForTimeout(250);
 const top=await page.locator('.topbar').boundingBox(),nav=await page.locator('.navbar').boundingBox();
 assert(Math.abs(top.height-44)<1,`topbar ${width}: ${top.height}`);assert(nav.height>=69,`navbar ${width}`);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
 if(width>=960){
  assert.equal(await page.locator('#menuToggle').evaluate(e=>getComputedStyle(e).display==='none'),true,`desktop toggle ${width}`);
  assert.equal(await page.locator('#mainNav .nav-link').count(),7);
  assert.equal(await page.evaluate(()=>document.querySelector('.navbar').scrollWidth<=innerWidth),true,`nav overflow ${width}`);
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,900)});await page.waitForTimeout(250);
  assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('topbar-collapsed')),true,`not collapsed ${width}`);
  const hiddenNav=await page.locator('.navbar').boundingBox();assert(Math.abs(hiddenNav.y)<2,`nav not at top ${width}: ${hiddenNav.y}`);
  assert.equal(await page.locator('.sticky-portal').isVisible(),true);assert.equal(await page.locator('.desktop-apply').isVisible(),true);
  await page.evaluate(()=>scrollTo(0,400));await page.waitForTimeout(250);
  assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('topbar-collapsed')),false,`not restored ${width}`);
 }else{
  assert.equal(await page.locator('.tb-motto').evaluate(e=>getComputedStyle(e).display==='none'),true);
  const b=await page.locator('#menuToggle').boundingBox();assert(Math.abs(b.width-44)<1&&Math.abs(b.height-44)<1,`toggle ${width}`);
  await page.locator('#menuToggle').click();await page.waitForTimeout(240);
  assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('nav-open')),true);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow), 'hidden');
  assert.equal(await page.locator('#navVeil').isVisible(),true);
  const d=await page.locator('#navDrawer').boundingBox();assert(Math.abs(d.x+d.width-width)<2&&d.width<=360,`drawer ${width}`);
  assert.equal(await page.evaluate(()=>document.querySelector('#navDrawer').contains(document.activeElement)),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('.drawer-phone')),true,`focus wrap ${width}`);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#mainNav .nav-link')),true,`focus wrap back ${width}`);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#menuToggle')),true);
  await page.locator('#menuToggle').click();await page.locator('#navVeil').click({position:{x:5,y:300}});assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,900)});await page.waitForTimeout(250);
  const stickyNav=await page.locator('.navbar').boundingBox();assert(Math.abs(stickyNav.y)<2,`mobile nav not sticky ${width}: ${stickyNav.y}`);assert.equal(await page.locator('#menuToggle').isVisible(),true);
 }
 assert.deepEqual(errors,[],`browser errors ${width}: ${errors.join(' | ')}`);await page.close();passed++;
 }
 for(const w of [1440,1120,960,959,360])await check(w);
 // Dark mode keeps visible controls and a non-white navbar treatment.
 const dark=await browser.newPage({viewport:{width:360,height:800}});await dark.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});await dark.locator('.theme-btn').click();assert(/dark/.test(await dark.locator('html').getAttribute('data-theme')));assert.equal(await dark.locator('#menuToggle').isVisible(),true);await dark.close();passed++;
 const titlePage=await browser.newPage({viewport:{width:390,height:844}});await titlePage.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});const original=await titlePage.title();await titlePage.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});assert.equal(await titlePage.title(),'Come Back Soon | Treasure Academy');await titlePage.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});assert.equal(await titlePage.title(),original);await titlePage.close();passed++;
 console.log(`HEADER BROWSER: ${passed} viewports/scenarios passed`);await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1)});
