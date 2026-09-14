import { getMembers, saveMember } from './services/members.js';

const roles = [
  { id: 'member', title: 'Membru al comunității', short: 'Membru', icon: 'icon-role-member.png', scene: 'scene-community-fire.png', color: 'terracotta', intro: 'Ești sau vrei să fii parte din lumea Viziunea.', points: ['Participi la evenimente', 'Te implici în proiecte', 'Cunoști oameni faini', 'Crești împreună cu noi'], action: 'Continuă ca membru', art: '◉' },
  { id: 'creator', title: 'Creator / Artist', short: 'Creator / Artist', icon: 'icon-role-creator.png', scene: 'scene-artist-workshop.png', color: 'sage', intro: 'Ai o idee, un proiect sau o pasiune artistică.', points: ['Acces la spații și resurse', 'Oameni cu care poți colabora', 'Posibilitatea de a testa și dezvolta idei', 'Susținere în producție'], action: 'Continuă ca artist', art: '✳' },
  { id: 'student', title: 'Student', short: 'Student', icon: 'icon-role-student.png', scene: 'scene-student-circle.png', color: 'blue', intro: 'Vrei să înveți practic, nu doar teoretic.', points: ['Ateliere și traininguri', 'Mentori din domeniu', 'Experiență pe proiecte reale', 'Intrare într-o comunitate creativă'], action: 'Continuă ca student', art: '◇' },
  { id: 'collaborator', title: 'Colaborator / Producător', short: 'Colaborator / Producător', icon: 'icon-role-collaborator.png', scene: 'scene-stage-production.png', color: 'purple', intro: 'Vrei să construim împreună proiecte și producții.', points: ['Echipă multidisciplinară', 'Producție scenografie & recuzită', 'Logistică & implementare', 'Flexibil, de la idei mici la proiecte mari'], action: 'Continuă ca partener', art: '⚙' },
  { id: 'organizer', title: 'Organizator / Client', short: 'Organizator / Client', icon: 'icon-role-organizer.png', scene: 'scene-festival-tent.png', color: 'gold', intro: 'Ai un eveniment, un spațiu sau o idee și cauți un partener.', points: ['Experiențe personalizate', 'Artiști, decoruri, activări', 'Producție completă sau pe module', 'Un partener creativ și de încredere'], action: 'Continuă ca organizator', art: '↗' },
];
const ecosystemAreas = [
  { id:'spaces', file:'activity-spaces-locations.png', title:'Spații și locații', description:'Locuri primitoare pentru întâlniri, ateliere și proiecte creative. Fiecare spațiu poate fi adaptat oamenilor și ideilor care îl animă.' },
  { id:'academy', file:'activity-workshops-academy.png', title:'Ateliere și Academy', description:'Învățare practică prin ateliere, mentorat și schimb de experiență cu oameni activi în domeniile lor.' },
  { id:'production', file:'activity-production-scenography.png', title:'Producție și scenografie', description:'De la primele schițe la decoruri, recuzită și producție tehnică, ideile prind formă împreună.' },
  { id:'events', file:'activity-events-experiences.png', title:'Evenimente și experiențe', description:'Întâlniri și evenimente construite în jurul comunității, artei și experiențelor împărtășite.' },
  { id:'art', file:'activity-art-marketing.png', title:'Artă și marketing', description:'Concepte vizuale și povești care ajută proiectele creative să ajungă la oamenii potriviți.' },
  { id:'nature', file:'activity-nature-community.png', title:'Natură și comunitate', description:'Activități și contexte în aer liber care apropie oamenii și deschid loc pentru idei noi.' },
];

const app = document.querySelector('#app');
let step = -1;
let chosenRole = roles[0].id;
let installPrompt;
let enteredApp = appInstalled();

function route() {
  const path=location.pathname.replace(/\/+$/, '');
  if(path.endsWith('/admin')) return 'admin';
  if(path.endsWith('/auth')) return 'auth';
  return 'home';
}
function go(path) { history.pushState({}, '', path); render(); }
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function asset(file) { return new URL(`../assets/${file}`, import.meta.url).href; }
function image(file, className = '', alt = '') { return `<img class="${className}" src="${asset(file)}" alt="${alt}" decoding="async">`; }
function requestAppFullscreen() {
  const root=document.documentElement;
  if(appInstalled() || document.fullscreenElement || !root.requestFullscreen) return;
  try { root.requestFullscreen({navigationUI:'hide'}).catch(()=>{}); } catch {}
}
function appInstalled() { return navigator.standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches; }
function isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function installAction() {
  if(appInstalled()) return '';
  if(installPrompt) return '<button class="install-link" data-install>Instalează aplicația</button>';
  if(isIOS()) return '<button class="install-link" data-install-help>Adaugă pe ecranul principal</button>';
  if(/Android/i.test(navigator.userAgent)) return '<button class="install-link" data-fullscreen>Deschide fără bara browserului</button>';
  return '';
}
function progress() { return `<div class="progress" aria-label="Pasul ${step + 1} din 5">${Array.from({ length: 5 }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`; }
function art(className, text) { return `<div class="art ${className}" aria-hidden="true"><div class="art-glow"></div><div class="art-lines"></div><span>${text}</span><small>OAMENI · IDEI · ÎMPREUNĂ</small></div>`; }
function roleCard(role) { return `<article class="role-card ${role.color}"><div class="role-icon">${image(role.icon)}</div><h2>${role.title}</h2><p>${role.intro}</p><ul>${role.points.map(p => `<li>${p}</li>`).join('')}</ul>${art(`role-art ${role.color}`, role.art)}<button class="primary role-submit" data-role="${role.id}">${role.action}<span>→</span></button></article>`; }

function render() {
  document.body.classList.toggle('admin-mode', route() === 'admin');
  app.innerHTML = route() === 'admin' ? adminView() : route() === 'auth' ? authView() : homeView();
  bind();
}
function homeView() {
  if(!enteredApp) return launchView();
  if(step < 0) return entryView();
  const pages = [
    `<section class="cover panel"><div class="cover-art">${art('cover-scene', '◌')}</div>${image('scene-community-fire.png','cover-people')}<div class="cover-shade"></div><div class="cover-copy"><div class="brand brand-light">Viziunea</div><p>Oameni<br> Spații<br> Idei<br> Împreună</p></div></section>`,
    `<section class="panel about"><span class="eyebrow">Viziunea</span><h1>Un loc unde arta prinde viață împreună cu oamenii<span class="spark">✳</span></h1><p class="lead">Viziunea este un hub creativ cu spații, resurse și o comunitate care transformă idei în experiențe reale.</p><div class="art sunset sunset-photo">${image('scene-sunset-group.png','sunset-image')}</div></section>`,
    `<section class="panel what"><div class="ecosystem-grid">${ecosystemAreas.map(area=>`<div class="ecosystem-card">${image(area.file,'ecosystem-art',`Ilustrație: ${area.title}`)}<button class="ecosystem-info" data-ecosystem-info="${area.id}" aria-label="Detalii: ${area.title}" aria-haspopup="dialog">i</button></div>`).join('')}</div></section>`,
    `<section class="panel inside"><span class="eyebrow">Inima proiectului</span><h1>O comunitate de creație care construiește experiențe reale.</h1><div class="heart">${image('icon-heart-community.png','heart-icon')}</div><ul class="checks"><li>Oameni care se susțin</li><li>Spații pentru idei curajoase</li><li>Învățare prin practică</li><li>De la concept la realitate</li><li>Proiecte cu impact cultural și social</li></ul></section>`,
    `<section class="panel choose"><span class="eyebrow">Cum vrei să continui?</span><h1>Alege rolul care ți se potrivește.</h1><p class="lead">Fiecare drum duce în aceeași direcție: mai multă artă în lume.</p><div class="role-links">${roles.map(r=>`<button class="role-link ${r.color}" data-role="${r.id}">${image(r.icon,'role-link-icon')}<span>${r.short}</span><b>›</b></button>`).join('')}</div></section>`,
  ];
  const content = pages[Math.min(step,4)];
  const coverScreen=step===0;
  const stepNav=`<nav class="step-nav"><button class="round nav-back" data-back aria-label="${step===0?'Înapoi la început':'Pasul anterior'}">←</button>${progress()}${step < 4 ? '<button class="round nav-next" data-next aria-label="Pasul următor">→</button>' : '<span class="nav-spacer" aria-hidden="true"></span>'}</nav>`;
  const contentWithNav=content.replace('</section>',`${stepNav}</section>`);
  return `<main class="onboarding ${coverScreen?'cover-onboarding':''}">${contentWithNav}</main>`;
}

function launchView() {
  return `<main class="launch-screen">${image('scene-creative-space.png','launch-image')}<div class="launch-shade"></div><section class="launch-content"><span class="launch-eyebrow">Oameni · Spații · Idei · Împreună</span><div class="launch-brand">Viziunea<span>✳</span></div><p>Un ecosistem creativ construit împreună.</p><button class="launch-open" data-enter-app>Deschide Viziunea <span>→</span></button></section></main>`;
}

function entryView() {
  return `<header class="topbar"><a href="./" class="brand" data-entry-home>Viziunea<span>✳</span></a><button class="text-button admin-link" data-admin>Admin ↗</button></header><main class="entry-wrap"><section class="entry-hero"><div class="entry-art">${image('scene-creative-space.png','entry-background')}<div class="entry-shade"></div><div class="entry-copy"><span class="eyebrow">Oameni · Spații · Idei · Împreună</span><h1>Viziunea</h1><p>Un ecosistem creativ construit împreună.</p></div><span class="entry-star">✳</span></div><div class="entry-options"><span class="eyebrow">Bine ai venit</span><h2>Unde vrei să mergem?</h2><button class="entry-choice existing" data-auth><span class="choice-icon">↗</span><span><b>Fac parte din comunitate</b><small>Intră în contul tău Viziunea</small></span><strong>→</strong></button><button class="entry-choice discover" data-discover><span class="choice-icon">✳</span><span><b>Doresc să descopăr Viziunea</b><small>Află ce construim împreună</small></span><strong>→</strong></button>${installAction()}<p class="entry-footnote">Un loc unde arta prinde viață împreună cu oamenii.</p></div></section></main>`;
}

function authView() {
  return `<main class="auth-wrap"><section class="auth-card"><span class="demo-badge">AUTENTIFICARE DEMO</span><button class="text-button auth-back" data-entry-home>← Înapoi</button><span class="auth-mark">✳</span><span class="eyebrow">Comunitatea Viziunea</span><h1>Bine ai revenit.</h1><p class="auth-intro">Autentifică-te pentru a continua în spațiul comunității.</p><form id="auth-form"><label>Email<input type="email" name="email" autocomplete="email" required placeholder="tu@exemplu.ro"></label><label>Parolă<input type="password" name="password" autocomplete="current-password" required minlength="6" placeholder="••••••••"></label><button class="primary" type="submit">Autentifică-te <span>→</span></button></form><p class="auth-message" aria-live="polite">Autentificarea este demonstrativă momentan; conturile Supabase nu sunt conectate.</p><div class="auth-divider"><span>ești nou aici?</span></div><button class="auth-discover" data-discover>Doresc să descopăr Viziunea <span>→</span></button></section></main>`;
}

function adminView() {
  const list = getMembers();
  return `<header class="admin-top"><a href="./" class="brand">Viziunea<span>✳</span></a><span class="demo-badge">DEMO • date locale</span><button class="text-button" data-home>← Înapoi la site</button></header><main class="admin-wrap"><div class="admin-title"><div><span class="eyebrow">Spațiul echipei</span><h1>Administrare</h1><p>Gestionează membrii comunității și informațiile lor esențiale.</p></div><button class="primary" data-add>+ Adaugă membru</button></div><div class="stats"><div><span>Membri înregistrați</span><b>${list.length}</b></div><div><span>Roluri active</span><b>${new Set(list.map(m=>m.role)).size}</b></div><div><span>Ultimul membru</span><b>${list.length ? escapeHTML(list[list.length - 1].name.split(' ')[0]) : '—'}</b></div></div><section class="table-card"><div class="table-head"><div><h2>Membri</h2><span>Lista comunității Viziunea</span></div><label class="search">⌕ <input type="search" id="filter" placeholder="Caută membri" /></label></div><div class="table-scroll"><table><thead><tr><th>Membru</th><th>Rol</th><th>Email</th><th>Oraș</th><th>Status</th></tr></thead><tbody id="member-rows">${memberRows(list)}</tbody></table></div></section><p class="admin-hint">Această demonstrație salvează datele în browser. Schema Supabase pregătită pentru conectare se află în <code>supabase/schema.sql</code>.</p></main>`;
}
function memberRows(list) { return list.map(m=>`<tr><td><div class="person"><span>${escapeHTML(m.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase())}</span><b>${escapeHTML(m.name)}</b></div></td><td>${escapeHTML(roles.find(r=>r.id===m.role)?.short || m.role)}</td><td>${escapeHTML(m.email)}</td><td>${escapeHTML(m.city || '—')}</td><td><i class="status-dot"></i> ${escapeHTML(m.status || 'Activ')}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Nu există membri încă.</td></tr>`; }
function bind() {
  app.querySelector('[data-enter-app]')?.addEventListener('click',()=>{requestAppFullscreen();enteredApp=true;render();});
  app.querySelectorAll('[data-entry-home]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();requestAppFullscreen();step=-1;go('./');}));
  app.querySelector('[data-auth]')?.addEventListener('click',()=>{requestAppFullscreen();go('./auth');});
  app.querySelectorAll('[data-discover]').forEach(b=>b.addEventListener('click',()=>{requestAppFullscreen();step=0;go('./');}));
  app.querySelector('#auth-form')?.addEventListener('submit',e=>{requestAppFullscreen();e.preventDefault();app.querySelector('.auth-message').textContent='Autentificarea nu este activată încă. Conectează proiectul Supabase pentru acces la conturi.';});
  app.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{requestAppFullscreen();step = Math.min(step + 1, 4); render();}));
  app.querySelector('[data-back]')?.addEventListener('click',()=>{requestAppFullscreen();if(step===0){step=-1;}else{step--;}render();});
  app.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{requestAppFullscreen();chosenRole=b.dataset.role;showJoinForm();}));
  app.querySelectorAll('[data-ecosystem-info]').forEach(button=>button.addEventListener('click',()=>showEcosystemInfo(button.dataset.ecosystemInfo)));
  app.querySelector('[data-fullscreen]')?.addEventListener('click',requestAppFullscreen);
  app.querySelector('[data-install]')?.addEventListener('click',async()=>{const prompt=installPrompt;if(!prompt)return;installPrompt=null;await prompt.prompt();await prompt.userChoice;render();});
  app.querySelector('[data-install-help]')?.addEventListener('click',showIOSInstallHelp);
  app.querySelector('[data-admin]')?.addEventListener('click',()=>{requestAppFullscreen();go('./admin');});
  app.querySelector('[data-home]')?.addEventListener('click',()=>{requestAppFullscreen();step=-1;go('./');});
  app.querySelector('[data-add]')?.addEventListener('click',()=>{requestAppFullscreen();showAdminForm();});
  app.querySelector('#filter')?.addEventListener('input',e=>{ const q=e.target.value.toLowerCase(); app.querySelector('#member-rows').innerHTML=memberRows(getMembers().filter(m=>`${m.name} ${m.email} ${m.city} ${m.role}`.toLowerCase().includes(q))); });
}
function showIOSInstallHelp() {
  const dialog=document.createElement('dialog');
  dialog.className='join-dialog install-dialog';
  dialog.innerHTML='<button class="dialog-close" aria-label="Închide">×</button><span class="eyebrow">Instalează aplicația</span><h2>Viziunea, pe ecranul principal.</h2><p>În Safari, apasă butonul Partajare, apoi alege „Adaugă la ecranul principal”. Deschide Viziunea din pictograma nouă pentru a o folosi fără bara browserului.</p><button class="primary" type="button">Am înțeles</button>';
  document.body.append(dialog);dialog.showModal();dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.primary').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
}
function showEcosystemInfo(id) {
  const area=ecosystemAreas.find(item=>item.id===id);
  if(!area)return;
  const dialog=document.createElement('dialog');
  dialog.className='join-dialog ecosystem-dialog';
  dialog.setAttribute('aria-labelledby','ecosystem-dialog-title');
  dialog.innerHTML=`<button class="dialog-close" type="button" aria-label="Închide">×</button><span class="eyebrow">Ecosistemul Viziunea</span><h2 id="ecosystem-dialog-title">${area.title}</h2><p>${area.description}</p><button class="primary ecosystem-understood" type="button">Am înțeles</button>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.querySelector('.ecosystem-understood').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>dialog.remove());
}
function showAdminForm() {
  const dialog=document.createElement('dialog');
  dialog.className='join-dialog';
  dialog.innerHTML=`<button class="dialog-close" aria-label="Închide">×</button><span class="eyebrow">Administrare</span><h2>Adaugă membru</h2><form id="join-form"><label>Numele<input name="name" required placeholder="Nume și prenume" /></label><label>Email<input name="email" type="email" required placeholder="tu@exemplu.ro" /></label><label>Orașul<input name="city" placeholder="Oraș" /></label><label>Rolul<select name="role">${roles.map(r=>`<option value="${r.id}">${r.title}</option>`).join('')}</select></label><button class="primary" type="submit">Salvează membrul <span>→</span></button></form><div class="form-message" aria-live="polite"></div>`;
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('.dialog-close').onclick=()=>dialog.close(); dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();try{await saveMember(Object.fromEntries(new FormData(e.target)));dialog.close();render();}catch{dialog.querySelector('.form-message').textContent='Nu am putut salva membrul. Verifică datele și încearcă din nou.';}});
}
function showJoinForm() {
  const role=roles.find(r=>r.id===chosenRole);
  const dialog=document.createElement('dialog');
  dialog.className='join-dialog';
  dialog.innerHTML=`<button class="dialog-close" aria-label="Închide">×</button>${image(role.scene,'join-scene-image')}<span class="eyebrow">Bun venit în Viziunea</span><h2>Hai să ne cunoaștem.</h2><p>Te înscrii ca <b>${role.title}</b>. Datele sunt folosite pentru a ține comunitatea conectată.</p><form id="join-form"><label>Numele tău<input name="name" autocomplete="name" required placeholder="Nume și prenume" /></label><label>Email<input name="email" type="email" autocomplete="email" required placeholder="tu@exemplu.ro" /></label><label>Orașul<input name="city" placeholder="De unde ești?" /></label><button class="primary" type="submit">Alătură-te comunității <span>→</span></button></form><div class="form-message" aria-live="polite"></div>`;
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('.dialog-close').onclick=()=>dialog.close(); dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').addEventListener('submit',async e=>{ e.preventDefault(); const data=Object.fromEntries(new FormData(e.target)); const message=dialog.querySelector('.form-message'); try { await saveMember({...data,role:chosenRole}); message.textContent='Mulțumim! Te-am adăugat în comunitatea Viziunea.'; e.target.reset(); } catch { message.textContent='Nu am putut salva înscrierea. Încearcă din nou.'; } });
}

window.addEventListener('popstate',render);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if(route()==='home'&&step<0)render();});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  let hadController=Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController){hadController=false;location.reload();}});
  navigator.serviceWorker.register(new URL('../service-worker.js', import.meta.url),{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
}
let refreshStart=null;
let carouselSwipeStart=null;
window.addEventListener('touchstart',event=>{
  if(event.touches.length!==1){refreshStart=null;carouselSwipeStart=null;return;}
  const touch=event.touches[0];
  refreshStart=touch.clientY<=130?{x:touch.clientX,y:touch.clientY}:null;
  const target=event.target;
  carouselSwipeStart=route()==='home'&&step>=0&&target.closest?.('.onboarding')&&!target.closest?.('button,a,input,dialog')?{x:touch.clientX,y:touch.clientY}:null;
},{passive:true});
window.addEventListener('touchmove',event=>{
  if(event.touches.length!==1)return;
  const touch=event.touches[0];
  if(refreshStart){
    const refreshDx=touch.clientX-refreshStart.x;
    const refreshDy=touch.clientY-refreshStart.y;
    if(refreshDy>100&&Math.abs(refreshDx)<60){refreshStart=null;carouselSwipeStart=null;location.reload();return;}
  }
  if(carouselSwipeStart){
    const dx=touch.clientX-carouselSwipeStart.x;
    const dy=touch.clientY-carouselSwipeStart.y;
    if(Math.abs(dx)<=65||Math.abs(dx)<=Math.abs(dy)*1.25)return;
    const direction=dx<0?1:-1;
    carouselSwipeStart=null;refreshStart=null;
    if(direction>0)step=Math.min(step+1,4);
    else step=step>0?step-1:-1;
    render();
  }
},{passive:true});
window.addEventListener('touchend',()=>{refreshStart=null;carouselSwipeStart=null;},{passive:true});
render();
