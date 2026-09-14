import { getMembers, getAdminMembers, saveMember } from './services/members.js';
import { getCurrentUser, isStaff, isSupabaseConfigured, signInWithEmail, signOut } from './services/auth.js';
import { getDirectoryItems, searchDirectory, saveDirectoryItem, DIRECTORY_TYPES, DIRECTORY_DOMAINS, VALUE_TYPES, LOCATION_MODES, SERVICE_SCOPES, SEARCH_SCOPES } from './services/directory.js';
import { createNeed, getCommunityNeeds, getMyNeeds, getAllNeeds, setNeedStatus } from './services/needs.js';
import { submitSuggestion, getMySuggestions, getApprovedSuggestionsForNeed, getPendingSuggestions, moderateSuggestion } from './services/suggestions.js';
import { getNotifications, markNotificationRead } from './services/notifications.js';
import { INTENTS, renderIntentStep, renderFlowView, renderItemDialog } from './views/orientation.js';

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
const explorationChoices = [
  { id:'creator', label:'Artist / Creator', description:'Am o idee, un proiect sau o practică artistică.', icon:'icon-role-creator.png', color:'sage' },
  { id:'collaborator', label:'Colaborator / Organizator', description:'Caut o echipă creativă pentru un proiect sau eveniment.', icon:'icon-role-organizer.png', color:'gold' },
];

const app = document.querySelector('#app');
const APP_ROOT = new URL('../', import.meta.url).pathname;
let step = -1;
let chosenRole = roles[0].id;
let explorationChoice = 'visitor';
let installPrompt;
let enteredApp = appInstalled();
let carouselTransitionTimer=null;
let animateCarouselEntry=false;
let selectedIntent='';
let currentUser=null;
let authNotice='';
let flow={screen:'search',intent:'unsure',query:'',city:'',county:'',region:'',country:'România',locationPreference:'flexible',maxDistance:'',remoteOk:true,scope:'city',results:[],needs:[],suggestions:[],notifications:[],approvedByNeed:{},unreadCount:0,activeNeed:null,activeItem:null,error:'',message:''};
let adminTab='members';
let adminData=[];
let adminAuthorized=!isSupabaseConfigured();
let adminLoading=false;
let adminError='';

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
  if(animateCarouselEntry){
    const panel=app.querySelector('.onboarding>.panel, .extended-view, .flow-view');
    if(panel)animateCarouselContent(panel,'in');
    animateCarouselEntry=false;
  }
  bind();
}
function animateCarouselContent(panel,direction) {
  const frames=direction==='out'
    ? [{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-28px)'}]
    : [{opacity:0,transform:'translateX(-28px)'},{opacity:1,transform:'translateX(0)'}];
  [...panel.children].filter(child=>!child.classList.contains('step-nav')).forEach(child=>{
    if(typeof child.animate!=='function')return;
    const animation=child.animate(frames,{duration:260,easing:'cubic-bezier(.22,.7,.2,1)',fill:'both'});
    if(direction==='in')animation.addEventListener('finish',()=>animation.cancel(),{once:true});
  });
}
function navigateCarousel(nextStep) {
  if(carouselTransitionTimer)return;
  const current=app.querySelector('.onboarding>.panel, .extended-view');
  if(!current){step=nextStep;render();return;}
  animateCarouselContent(current,'out');
  carouselTransitionTimer=window.setTimeout(()=>{
    step=nextStep;
    animateCarouselEntry=step>=0&&step<=5;
    carouselTransitionTimer=null;
    render();
  },260);
}
function homeView() {
  if(!enteredApp) return launchView();
  if(step===5) return renderFlowView({...flow,user:currentUser,demoMode:!isSupabaseConfigured()});
  if(step < 0) return entryView();
  const pages = [
    `<section class="cover panel"><div class="cover-art">${art('cover-scene', '◌')}</div>${image('scene-community-fire.png','cover-people')}<div class="cover-shade"></div><div class="cover-copy"><div class="brand brand-light">Viziunea</div><p>Oameni<br> Spații<br> Idei<br> Împreună</p></div></section>`,
    `<section class="panel about"><span class="eyebrow">Viziunea</span><h1>Un loc unde arta prinde viață împreună cu oamenii<span class="spark">✳</span></h1><p class="lead">Viziunea este un hub creativ cu spații, resurse și o comunitate care transformă idei în experiențe reale.</p><div class="art sunset sunset-photo">${image('scene-sunset-group.png','sunset-image')}</div></section>`,
    `<section class="panel what"><div class="ecosystem-grid">${ecosystemAreas.map(area=>`<div class="ecosystem-card">${image(area.file,'ecosystem-art',`Ilustrație: ${area.title}`)}<button class="ecosystem-info" data-ecosystem-info="${area.id}" aria-label="Detalii: ${area.title}" aria-haspopup="dialog">i</button></div>`).join('')}</div></section>`,
    `<section class="panel inside"><span class="eyebrow">Inima proiectului</span><h1>O comunitate de creație care construiește experiențe reale.</h1><div class="heart">${image('icon-heart-community.png','heart-icon')}</div><ul class="checks"><li>Oameni care se susțin</li><li>Spații pentru idei curajoase</li><li>Învățare prin practică</li><li>De la concept la realitate</li><li>Proiecte cu impact cultural și social</li></ul></section>`,
    renderIntentStep(selectedIntent),
  ];
  const content = pages[Math.min(step,4)];
  const coverScreen=step===0;
  const stepNav=`<nav class="step-nav"><button class="round nav-back" data-back aria-label="${step===0?'Înapoi la început':'Pasul anterior'}">←</button>${progress()}<button class="round nav-next" data-next aria-label="Pasul următor" ${step===4&&!selectedIntent?'disabled':''}>→</button></nav>`;
  const contentWithNav=content.replace('</section>',`${stepNav}</section>`);
  return `<main class="onboarding ${coverScreen?'cover-onboarding':''}">${contentWithNav}</main>`;
}

function extendedPresentationView() {
  const selected=explorationChoices.find(choice=>choice.id===explorationChoice);
  return `<main class="extended-view"><button class="extended-back" data-presentation-back><span>←</span> Înapoi la roluri</button><section class="extended-card"><div class="extended-hero">${image('scene-creative-space.png','extended-image')}<div class="extended-shade"></div><div class="extended-wordmark">Viziunea</div></div><div class="extended-copy"><span class="eyebrow">${selected?`Interes selectat · ${selected.label}`:'Explorare liberă · fără rol'}</span><h1>Un ecosistem creativ construit împreună.</h1><p class="lead">Viziunea aduce împreună oameni, spații și resurse pentru ca ideile să devină proiecte și experiențe reale.</p><div class="extended-grid"><article><span>⌂</span><div><b>Spații pentru idei</b><small>Locuri de întâlnire, lucru și inspirație.</small></div></article><article><span>✳</span><div><b>Învățare practică</b><small>Ateliere și schimb de experiență.</small></div></article><article><span>◌</span><div><b>Oameni care colaborează</b><small>O comunitate cu perspective diferite.</small></div></article><article><span>↗</span><div><b>Proiecte în realitate</b><small>De la concept la producție și eveniment.</small></div></article></div><p class="extended-footnote">Explorezi fără înscriere. Poți reveni oricând la alegerea rolului.</p></div></section></main>`;
}

function launchView() {
  return `<main class="launch-screen">${image('scene-creative-space.png','launch-image')}<div class="launch-shade"></div><section class="launch-content"><span class="launch-eyebrow">Oameni · Spații · Idei · Împreună</span><div class="launch-brand">Viziunea<span>✳</span></div><p>Un ecosistem creativ construit împreună.</p><button class="launch-open" data-enter-app>Deschide Viziunea <span>→</span></button></section></main>`;
}

function entryView() {
  return `<header class="topbar"><a href="./" class="brand" data-entry-home>Viziunea<span>✳</span></a><button class="text-button admin-link" data-admin>Admin ↗</button></header><main class="entry-wrap"><section class="entry-hero"><div class="entry-art">${image('scene-creative-space.png','entry-background')}<div class="entry-shade"></div><div class="entry-copy"><span class="eyebrow">Oameni · Spații · Idei · Împreună</span><h1>Viziunea</h1><p>Un ecosistem creativ construit împreună.</p></div><span class="entry-star">✳</span></div><div class="entry-options"><span class="eyebrow">Bine ai venit</span><h2>Unde vrei să mergem?</h2><button class="entry-choice existing" data-auth><span class="choice-icon">↗</span><span><b>Fac parte din comunitate</b><small>Intră în contul tău Viziunea</small></span><strong>→</strong></button><button class="entry-choice discover" data-discover><span class="choice-icon">✳</span><span><b>Doresc să descopăr Viziunea</b><small>Află ce construim împreună</small></span><strong>→</strong></button>${installAction()}<p class="entry-footnote">Un loc unde arta prinde viață împreună cu oamenii.</p></div></section></main>`;
}

function authView() {
  const demo=!isSupabaseConfigured();
  return `<main class="auth-wrap"><section class="auth-card"><span class="demo-badge">${demo?'AUTENTIFICARE DEMO · IDENTITATE LOCALĂ':'SUPABASE AUTH · LINK PE EMAIL'}</span><button class="text-button auth-back" data-entry-home>← Înapoi</button><span class="auth-mark">✳</span><span class="eyebrow">Comunitatea Viziunea</span><h1>Bine ai revenit.</h1><p class="auth-intro">${demo?'Introdu un email pentru a continua în modul demo.':'Primești un link securizat pe email. Nu ai nevoie de parolă.'}</p><form id="auth-form"><label>Nume (opțional)<input type="text" name="display_name" autocomplete="name" placeholder="Nume și prenume"></label><label>Email<input type="email" name="email" autocomplete="email" required placeholder="tu@exemplu.ro"></label><button class="primary" type="submit">${demo?'Continuă în demo':'Trimite link de autentificare'} <span>→</span></button></form><p class="auth-message" aria-live="polite">${authNotice || (demo?'Datele demo se păstrează numai în acest browser.':'')}</p><div class="auth-divider"><span>sau</span></div><button class="auth-discover" data-discover>Doresc să descopăr Viziunea <span>→</span></button></section></main>`;
}

function adminView() {
  const list = adminTab==='members'&&Array.isArray(adminData)?adminData:[];
  const demo=!isSupabaseConfigured();
  const tabs=[['members','Membri'],['needs','Nevoi'],['suggestions','Sugestii'],['directory','Director']];
  if(!demo&&!currentUser)return `<header class="admin-top"><a href="${APP_ROOT}" class="brand" data-entry-home>Viziunea<span>✳</span></a><span class="demo-badge">ACCES STAFF</span><button class="text-button" data-home>← Înapoi la site</button></header><main class="admin-wrap"><section class="auth-card"><h1>Autentificare necesară.</h1><p class="lead">Conectează-te cu un cont autorizat de echipa Viziunea.</p><button class="primary" data-auth-go>Continuă cu emailul <span>→</span></button></section></main>`;
  if(!demo&&!adminAuthorized)return `<header class="admin-top"><a href="${APP_ROOT}" class="brand" data-entry-home>Viziunea<span>✳</span></a><span class="demo-badge">ACCES STAFF</span><button class="text-button" data-home>← Înapoi la site</button></header><main class="admin-wrap"><section class="auth-card"><h1>${adminLoading?'Verificăm accesul…':'Zona echipei.'}</h1><p class="lead">${escapeHTML(adminError||'Acest cont nu are acces la administrare.')}</p><button class="text-button" data-home>← Înapoi la site</button></section></main>`;
  const body=adminTab==='members'?`
    <div class="stats"><div><span>Membri înregistrați</span><b>${list.length}</b></div><div><span>Roluri active</span><b>${new Set(list.map(m=>m.role)).size}</b></div><div><span>Ultimul membru</span><b>${list.length?escapeHTML(list[0].name.split(' ')[0]):'—'}</b></div></div>
    <section class="table-card"><div class="table-head"><div><h2>Membri</h2><span>Lista comunității Viziunea</span></div><label class="search">⌕ <input type="search" id="filter" placeholder="Caută membri" /></label></div><div class="table-scroll"><table><thead><tr><th>Membru</th><th>Rol</th><th>Email</th><th>Oraș</th><th>Status</th></tr></thead><tbody id="member-rows">${memberRows(list)}</tbody></table></div></section>${demo?'<p class="admin-hint">DEMO · datele rămân în acest browser.</p>':''}`:
    adminTab==='needs'?`<div class="admin-record-list">${(adminData||[]).length?(adminData||[]).map(n=>`<article class="admin-record"><span class="eyebrow">${escapeHTML(n.status)} · ${escapeHTML(n.city||n.county||'Fără localitate')}</span><h2>${escapeHTML(n.query)}</h2><p>${escapeHTML(n.intent)}${n.remote_ok?' · remote în regulă':''}</p></article>`).join(''):'<p class="empty-state">Nu există nevoi salvate.</p>'}</div>`:
    adminTab==='suggestions'?`<div class="admin-record-list">${(adminData||[]).length?(adminData||[]).map(row=>`<article class="admin-record"><span class="eyebrow">${escapeHTML(row.suggestion_type)} · În așteptarea moderării</span><h2>${escapeHTML(row.name)}</h2><p>${escapeHTML(row.description)}</p><p>Legată de: ${escapeHTML(row.needText||'nevoie')}</p>${row.contact_url?`<a href="${escapeHTML(row.contact_url)}" target="_blank" rel="noopener">Deschide linkul ↗</a>`:''}<div class="need-actions"><button class="secondary" data-moderate="${escapeHTML(row.id)}" data-status="rejected">Respinge</button><button class="primary" data-moderate="${escapeHTML(row.id)}" data-status="approved">Aprobă <span>✓</span></button></div></article>`).join(''):'<p class="empty-state">Nu sunt sugestii de moderat.</p>'}</div>`:
    `<button class="primary directory-add" data-add-directory>+ Adaugă în director <span>→</span></button><div class="admin-record-list">${(adminData||[]).map(item=>`<article class="admin-record"><span class="eyebrow">${escapeHTML(item.item_type)} · ${escapeHTML(item.domain)} · ${escapeHTML(item.status)}</span><h2>${escapeHTML(item.title)}</h2><p>${escapeHTML(item.description)}</p><p>${escapeHTML([item.city,item.county,item.region].filter(Boolean).join(', ')||item.location_mode)} · ${escapeHTML(item.location_mode)} · ${escapeHTML(item.service_area_scope)}${item.travel_radius_km?` · rază ${item.travel_radius_km} km`:''}</p></article>`).join('')}</div>`;
  return `<header class="admin-top"><a href="${APP_ROOT}" class="brand" data-entry-home>Viziunea<span>✳</span></a><span class="demo-badge">${demo?'DEMO • date locale':'ECHIPA VIZIUNEA'}</span><button class="text-button" data-home>← Înapoi la site</button></header><main class="admin-wrap"><div class="admin-title"><div><span class="eyebrow">Spațiul echipei</span><h1>Administrare</h1><p>Nevoi, sugestii și resursele comunității.</p></div>${adminTab==='members'?'<button class="primary" data-add>+ Adaugă membru</button>':''}</div><nav class="admin-tabs">${tabs.map(([id,label])=>`<button class="${adminTab===id?'active':''}" data-admin-tab="${id}">${label}</button>`).join('')}</nav>${adminError?`<p class="flow-error">${escapeHTML(adminError)}</p>`:''}${body}</main>`;
}
function memberRows(list) { return list.map(m=>`<tr><td><div class="person"><span>${escapeHTML(m.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase())}</span><b>${escapeHTML(m.name)}</b></div></td><td>${escapeHTML(roles.find(r=>r.id===m.role)?.short || m.role)}</td><td>${escapeHTML(m.email)}</td><td>${escapeHTML(m.city || '—')}</td><td><i class="status-dot"></i> ${escapeHTML(m.status || 'Activ')}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Nu există membri încă.</td></tr>`; }

const pendingActionKey='viziunea.pending-action.v1';
function authPath(){return new URL('../auth/',import.meta.url).pathname;}
function adminPath(){return new URL('../admin/',import.meta.url).pathname;}
function currentIntentLabel(){return INTENTS.find(item=>item.id===flow.intent)?.label || 'Explorează';}
function flowPlaceholder(){
  return ({create:'o idee sau un proiect pe care vrei să-l construiești',find:'un fotograf, un atelier sau o experiență',offer:'o resursă sau o abilitate pe care o poți oferi',learn:'un curs, atelier sau mentor',participate:'o experiență sau o comunitate',organize:'un spațiu ori o echipă pentru un eveniment',unsure:'spune-ne ce ți-ar prinde bine'})[flow.intent] || 'un fotograf pentru un proiect';
}
function renderCurrent(){app.innerHTML=route()==='admin'?adminView():route()==='auth'?authView():homeView();bind();}
function openAuth(pending=null){
  if(pending)sessionStorage.setItem(pendingActionKey,JSON.stringify(pending));
  go(authPath());
}
function saveNeedDraftFromFlow(){return {intent:flow.intent,query:flow.query,city:flow.city,county:flow.county,region:flow.region,country:flow.country,location_preference:flow.locationPreference,max_distance_km:flow.maxDistance,remote_ok:flow.remoteOk};}
async function finishAuthentication(user){
  currentUser=user;
  let pending=null;
  try{pending=JSON.parse(sessionStorage.getItem(pendingActionKey)||'null');}catch{}
  sessionStorage.removeItem(pendingActionKey);
  history.replaceState({},'',pending?.type==='return'?pending.path:APP_ROOT);
  authNotice='';
  if(pending?.type==='need'){
    try{await createNeed(pending.input,user);flow.message='Am salvat nevoia ta. O afișăm comunității fără nume sau date de contact.';flow.screen='my-needs';step=5;}
    catch(error){flow.error=error.message;flow.screen='search';step=5;}
  }else if(pending?.type==='suggestion'){
    const needs=await getCommunityNeeds().catch(()=>[]);
    flow.needs=needs;flow.activeNeed=needs.find(item=>item.id===pending.need_id)||null;flow.suggestionType=pending.suggestionType||'referral';flow.screen='suggestion';step=5;
  }else if(pending?.type==='flow'){
    flow.screen=pending.screen||'search';step=5;
  }else if(pending?.type==='return'){
    step=pending.path===adminPath()?5:-1;
  }else{
    step=-1;
  }
  if(pending?.type==='return'&&pending.path===adminPath())adminAuthorized=await isStaff(user);
  renderCurrent();
  if(route()==='admin')void loadAdminTab();
  else if(step===5)void loadFlowData(flow.screen);
}

async function initializeAuth(){
  try{currentUser=await getCurrentUser();}catch{currentUser=null;}
  if(route()==='auth'&&currentUser){await finishAuthentication(currentUser);return;}
  if(route()==='admin')void loadAdminTab();
  else if(route()==='home'&&step===5)renderCurrent();
}

async function runSearch(scope='city'){
  if(!SEARCH_SCOPES.includes(scope))scope='city';
  flow.scope=scope;flow.error='';flow.results=[];
  flow.scopeLabel=({city:'zona ta cea mai apropiată',nearby:'zona apropiată',county:'județul selectat',national:'acoperirea națională',online:'opțiunile online'})[scope]||'';
  renderCurrent();
  try{
    flow.results=await searchDirectory({query:flow.query,intent:flow.intent,city:flow.city,county:flow.county,region:flow.region,country:flow.country,scope,remoteOk:flow.remoteOk,locationPreference:flow.locationPreference,limit:5});
  }catch(error){flow.error=`Nu am putut încărca sugestiile. ${error.message||'Verifică conexiunea și încearcă din nou.'}`;}
  flow.screen='results';renderCurrent();
}

async function loadFlowData(screen=flow.screen){
  flow.error='';
  try{
    if(screen==='community')flow.needs=await getCommunityNeeds();
    if(screen==='my-needs'&&currentUser){
      flow.needs=await getMyNeeds(currentUser);
      const pairs=await Promise.all(flow.needs.map(async need=>[need.id,await getApprovedSuggestionsForNeed(need.id)]));
      flow.approvedByNeed=Object.fromEntries(pairs);
    }
    if(screen==='my-suggestions'&&currentUser)flow.suggestions=await getMySuggestions(currentUser);
    if(screen==='notifications'&&currentUser){
      flow.notifications=await getNotifications(currentUser);
      flow.unreadCount=flow.notifications.filter(item=>!item.read_at).length;
      await Promise.all(flow.notifications.filter(item=>!item.read_at).map(item=>markNotificationRead(item.id,currentUser)));
      flow.notifications=flow.notifications.map(item=>({...item,read_at:item.read_at||new Date().toISOString()}));flow.unreadCount=0;
    }
  }catch(error){flow.error=error.message||'Nu am putut încărca informațiile.';}
  if(route()==='home'&&step===5){renderCurrent();}
}

async function loadAdminTab(){
  if(route()!=='admin')return;
  adminLoading=true;adminError='';renderCurrent();
  try{
    if(isSupabaseConfigured()){
      currentUser ||= await getCurrentUser();
      adminAuthorized=await isStaff(currentUser);
      if(!adminAuthorized){adminError=currentUser?'Acest cont nu are acces la administrare.':'Autentifică-te cu un cont autorizat de staff.';adminLoading=false;renderCurrent();return;}
    }else adminAuthorized=true;
    if(adminTab==='members')adminData=await getAdminMembers();
    if(adminTab==='needs')adminData=await getAllNeeds();
    if(adminTab==='suggestions'){
      const [suggestions,needs]=await Promise.all([getPendingSuggestions(),getAllNeeds()]);
      adminData=suggestions.map(row=>({...row,needText:needs.find(need=>need.id===row.need_id)?.query||''}));
    }
    if(adminTab==='directory')adminData=await getDirectoryItems({includeUnpublished:true});
  }catch(error){adminError=error.message||'Nu am putut încărca datele panoului.';adminData=[];}
  adminLoading=false;renderCurrent();
}

function openDirectoryForm(){
  const dialog=document.createElement('dialog');dialog.className='join-dialog directory-dialog';
  const options=(items,selected='')=>items.map(value=>`<option value="${value}" ${value===selected?'selected':''}>${value.replaceAll('_',' ')}</option>`).join('');
  dialog.innerHTML=`<button class="dialog-close" type="button" aria-label="Închide">×</button><span class="eyebrow">Directorul Viziunea</span><h2>Adaugă o resursă</h2><form id="directory-form"><label>Titlu<input name="title" required minlength="2" maxlength="180"></label><label>Descriere<textarea name="description" rows="3"></textarea></label><div class="geo-inputs"><label>Tip<select name="item_type">${options(DIRECTORY_TYPES)}</select></label><label>Domeniu<select name="domain">${options(DIRECTORY_DOMAINS)}</select></label><label>Tip de valoare<select name="value_type">${options(VALUE_TYPES)}</select></label><label>Etichete, separate prin virgulă<input name="tags" placeholder="fotografie, eveniment"></label><label>Oraș<input name="city"></label><label>Județ<input name="county"></label><label>Regiune<input name="region" placeholder="Sud-Est"></label><label>Țară<input name="country" value="România"></label><label>Mod de locație<select name="location_mode">${options(LOCATION_MODES,'location_independent')}</select></label><label>Zonă de acoperire<select name="service_area_scope">${options(SERVICE_SCOPES,'online')}</select></label><label>Rază de deplasare, km<input name="travel_radius_km" type="number" min="1" max="2000"></label></div><label>Link de contact<input name="contact_url" type="url" placeholder="https://"></label><button class="primary" type="submit">Publică în director <span>→</span></button><p class="form-message"></p></form>`;
  const placeLabel=document.createElement('label');placeLabel.innerHTML='Numele locației (opțional)<input name="location_label" placeholder="Munții Măcinului / Centrul vechi">';dialog.querySelector('[name="city"]').parentElement.before(placeLabel);
  document.body.append(dialog);dialog.showModal();dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('#directory-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=Object.fromEntries(new FormData(event.currentTarget));form.travel_radius_km=form.travel_radius_km?Number(form.travel_radius_km):null;form.status='published';
    try{await saveDirectoryItem(form);dialog.close();adminTab='directory';void loadAdminTab();}
    catch(error){dialog.querySelector('.form-message').textContent=error.message||'Nu am putut salva resursa.';}
  });
}

function bind() {
  app.querySelector('[data-enter-app]')?.addEventListener('click',()=>{requestAppFullscreen();enteredApp=true;render();});
  app.querySelectorAll('[data-entry-home], [data-flow-home]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();requestAppFullscreen();step=-1;flow.message='';sessionStorage.removeItem(pendingActionKey);go(APP_ROOT);}));
  app.querySelector('[data-auth]')?.addEventListener('click',()=>{requestAppFullscreen();openAuth();});
  app.querySelectorAll('[data-discover]').forEach(b=>b.addEventListener('click',()=>{requestAppFullscreen();selectedIntent='';flow.intent='unsure';flow.screen='search';step=0;animateCarouselEntry=true;sessionStorage.removeItem(pendingActionKey);go(APP_ROOT);}));
  app.querySelector('#auth-form')?.addEventListener('submit',async event=>{
    event.preventDefault();requestAppFullscreen();authNotice='';
    const form=Object.fromEntries(new FormData(event.currentTarget));
    try{
      const result=await signInWithEmail(form.email,form.display_name);
      if(result.mode==='demo')await finishAuthentication(result.user);
      else{authNotice='Ți-am trimis un link de autentificare. Deschide-l pentru a continua; cererea ta va fi păstrată până atunci.';renderCurrent();}
    }catch(error){authNotice=error.message||'Nu am putut trimite linkul. Verifică adresa și încearcă din nou.';renderCurrent();}
  });
  app.querySelectorAll('[data-intent]').forEach(button=>button.addEventListener('click',()=>{selectedIntent=button.dataset.intent;render();}));
  app.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{
    requestAppFullscreen();
    if(step===4){if(!selectedIntent)return;flow.intent=selectedIntent;flow.query='';flow.placeholder=flowPlaceholder();flow.screen='search';flow.scope='city';navigateCarousel(5);}
    else navigateCarousel(Math.min(step+1,4));
  }));
  app.querySelector('[data-back]')?.addEventListener('click',()=>{requestAppFullscreen();navigateCarousel(step===0?-1:step-1);});
  app.querySelectorAll('[data-flow]').forEach(button=>button.addEventListener('click',()=>{flow.screen=button.dataset.flow;flow.error='';renderCurrent();void loadFlowData(flow.screen);}));
  app.querySelector('[data-intro-intent]')?.addEventListener('click',()=>{step=4;render();});
  app.querySelector('#orientation-search')?.addEventListener('submit',event=>{
    event.preventDefault();const form=Object.fromEntries(new FormData(event.currentTarget));
    flow.query=String(form.query||'').trim();flow.city=String(form.city||'').trim();flow.county=String(form.county||'').trim();flow.region=String(form.region||'').trim();flow.country=String(form.country||'România').trim();flow.locationPreference=form.location_preference||'flexible';flow.remoteOk=Boolean(form.remote_ok);flow.maxDistance=form.max_distance_km||'';void runSearch('city');
  });
  app.querySelectorAll('[data-expand-scope]').forEach(button=>button.addEventListener('click',()=>void runSearch(button.dataset.expandScope)));
  app.querySelector('#orientation-search select[name="location_preference"]')?.addEventListener('change',event=>{
    const checkbox=app.querySelector('#orientation-search input[name="remote_ok"]');
    if(event.target.value==='remote'||event.target.value==='hybrid')checkbox.checked=true;
    if(event.target.value==='fixed'||event.target.value==='travels')checkbox.checked=false;
  });
  app.querySelector('[data-no-match]')?.addEventListener('click',()=>{flow.screen='unmatched';renderCurrent();});
  app.querySelectorAll('[data-create-need]').forEach(button=>button.addEventListener('click',async()=>{
    flow.error='';
    if(currentUser){try{await createNeed(saveNeedDraftFromFlow(),currentUser);flow.message='Am salvat nevoia ta. Comunitatea o vede anonim.';flow.screen='my-needs';renderCurrent();void loadFlowData('my-needs');}catch(error){flow.error=error.message;renderCurrent();}}
    else openAuth({type:'need',input:saveNeedDraftFromFlow()});
  }));
  app.querySelectorAll('[data-suggest], [data-help]').forEach(button=>button.addEventListener('click',()=>{
    const need=flow.needs.find(item=>item.id===button.dataset.suggest||item.id===button.dataset.help);
    if(!need)return;
    flow.activeNeed=need;flow.suggestionType=button.hasAttribute('data-help')?'self':'referral';flow.error='';
    if(currentUser){flow.screen='suggestion';renderCurrent();}
    else openAuth({type:'suggestion',need_id:need.id,suggestionType:flow.suggestionType});
  }));
  app.querySelector('#suggestion-form')?.addEventListener('submit',async event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));
    try{await submitSuggestion({...values,need_id:flow.activeNeed.id,suggestion_type:values.suggestion_type},currentUser);flow.message='Mulțumim. Sugestia a fost trimisă spre moderare.';flow.screen='my-suggestions';renderCurrent();void loadFlowData('my-suggestions');}
    catch(error){flow.error=error.message||'Nu am putut trimite sugestia.';renderCurrent();}
  });
  app.querySelectorAll('[data-item-details]').forEach(button=>button.addEventListener('click',()=>{
    flow.activeItem=flow.results.find(result=>result.item.id===button.dataset.itemDetails)?.item||null;
    const markup=renderItemDialog(flow.activeItem);if(!markup)return;
    const holder=document.createElement('div');holder.innerHTML=markup;const dialog=holder.firstElementChild;document.body.append(dialog);dialog.showModal();dialog.querySelectorAll('[data-close-dialog]').forEach(control=>control.addEventListener('click',()=>dialog.close()));dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>dialog.remove());
  }));
  app.querySelectorAll('[data-resolve-need]').forEach(button=>button.addEventListener('click',async()=>{try{await setNeedStatus(button.dataset.resolveNeed,'resolved',currentUser);void loadFlowData('my-needs');}catch(error){flow.error=error.message;renderCurrent();}}));
  app.querySelectorAll('[data-notification]').forEach(button=>button.addEventListener('click',async()=>{try{await markNotificationRead(button.dataset.notification,currentUser);flow.screen='my-needs';renderCurrent();void loadFlowData('my-needs');}catch(error){flow.error=error.message;renderCurrent();}}));
  app.querySelectorAll('[data-auth-go]').forEach(button=>button.addEventListener('click',()=>openAuth(route()==='admin'?{type:'return',path:adminPath()}:{type:'flow',screen:flow.screen})));
  app.querySelector('[data-sign-out]')?.addEventListener('click',async()=>{try{await signOut();currentUser=null;flow.screen='search';renderCurrent();}catch(error){flow.error=error.message;renderCurrent();}});
  app.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{requestAppFullscreen();chosenRole=b.dataset.role;showJoinForm();}));
  app.querySelectorAll('[data-ecosystem-info]').forEach(button=>button.addEventListener('click',()=>showEcosystemInfo(button.dataset.ecosystemInfo)));
  app.querySelector('[data-fullscreen]')?.addEventListener('click',requestAppFullscreen);
  app.querySelector('[data-install]')?.addEventListener('click',async()=>{const prompt=installPrompt;if(!prompt)return;installPrompt=null;await prompt.prompt();await prompt.userChoice;render();});
  app.querySelector('[data-install-help]')?.addEventListener('click',showIOSInstallHelp);
  app.querySelector('[data-admin]')?.addEventListener('click',()=>{requestAppFullscreen();go(adminPath());void loadAdminTab();});
  app.querySelector('[data-home]')?.addEventListener('click',()=>{requestAppFullscreen();step=-1;go(APP_ROOT);});
  app.querySelector('[data-add]')?.addEventListener('click',()=>{requestAppFullscreen();showAdminForm();});
  app.querySelectorAll('[data-admin-tab]').forEach(button=>button.addEventListener('click',()=>{adminTab=button.dataset.adminTab;void loadAdminTab();}));
  app.querySelectorAll('[data-moderate]').forEach(button=>button.addEventListener('click',async()=>{try{await moderateSuggestion(button.dataset.moderate,button.dataset.status);void loadAdminTab();}catch(error){adminError=error.message;renderCurrent();}}));
  app.querySelector('[data-add-directory]')?.addEventListener('click',openDirectoryForm);
  app.querySelector('#filter')?.addEventListener('input',e=>{ const q=e.target.value.toLowerCase(); app.querySelector('#member-rows').innerHTML=memberRows(adminData.filter(m=>`${m.name} ${m.email} ${m.city} ${m.role}`.toLowerCase().includes(q))); });
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
  dialog.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();try{await saveMember(Object.fromEntries(new FormData(e.target)));dialog.close();adminTab='members';void loadAdminTab();}catch{dialog.querySelector('.form-message').textContent='Nu am putut salva membrul. Verifică datele și încearcă din nou.';}});
}
function showJoinForm() {
  const role=roles.find(r=>r.id===chosenRole);
  const dialog=document.createElement('dialog');
  dialog.className='join-dialog';
  dialog.innerHTML=`<button class="dialog-close" aria-label="Închide">×</button>${image(role.scene,'join-scene-image')}<span class="eyebrow">Bun venit în Viziunea</span><h2>Hai să ne cunoaștem.</h2><p>Te înscrii ca <b>${role.title}</b>. Datele sunt folosite pentru a ține comunitatea conectată.</p><form id="join-form"><label>Numele tău<input name="name" autocomplete="name" required placeholder="Nume și prenume" /></label><label>Email<input name="email" type="email" autocomplete="email" required placeholder="tu@exemplu.ro" /></label><label>Orașul<input name="city" placeholder="De unde ești?" /></label><button class="primary" type="submit">Alătură-te comunității <span>→</span></button></form><div class="form-message" aria-live="polite"></div>`;
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('.dialog-close').onclick=()=>dialog.close(); dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').addEventListener('submit',async e=>{ e.preventDefault(); const data=Object.fromEntries(new FormData(e.target)); const message=dialog.querySelector('.form-message'); try { await saveMember({...data,role:chosenRole}); message.textContent='Mulțumim! Te-am adăugat în comunitatea Viziunea.'; e.target.reset(); } catch { message.textContent='Nu am putut salva înscrierea. Încearcă din nou.'; } });
}

window.addEventListener('popstate',()=>{if(route()!=='auth'&&!currentUser)sessionStorage.removeItem(pendingActionKey);render();if(route()==='admin')void loadAdminTab();});
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
void initializeAuth();
