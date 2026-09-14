import { getMembers, saveMember } from './services/members.js';

const roles = [
  { id: 'member', title: 'Membru al comunității', short: 'Membru', icon: '♟', color: 'terracotta', intro: 'Ești sau vrei să fii parte din lumea Viziunea.', points: ['Participi la evenimente', 'Te implici în proiecte', 'Cunoști oameni faini', 'Crești împreună cu noi'], action: 'Continuă ca membru', art: '◉' },
  { id: 'creator', title: 'Creator / Artist', short: 'Creator / Artist', icon: '✳', color: 'sage', intro: 'Ai o idee, un proiect sau o pasiune artistică.', points: ['Acces la spații și resurse', 'Oameni cu care poți colabora', 'Posibilitatea de a testa și dezvolta idei', 'Susținere în producție'], action: 'Continuă ca artist', art: '✳' },
  { id: 'student', title: 'Student', short: 'Student', icon: '◇', color: 'blue', intro: 'Vrei să înveți practic, nu doar teoretic.', points: ['Ateliere și traininguri', 'Mentori din domeniu', 'Experiență pe proiecte reale', 'Intrare într-o comunitate creativă'], action: 'Continuă ca student', art: '◇' },
  { id: 'collaborator', title: 'Colaborator / Producător', short: 'Colaborator / Producător', icon: '⚙', color: 'purple', intro: 'Vrei să construim împreună proiecte și producții.', points: ['Echipă multidisciplinară', 'Producție scenografie & recuzită', 'Logistică & implementare', 'Flexibil, de la idei mici la proiecte mari'], action: 'Continuă ca partener', art: '⚙' },
  { id: 'organizer', title: 'Organizator / Client', short: 'Organizator / Client', icon: '↗', color: 'gold', intro: 'Ai un eveniment, un spațiu sau o idee și cauți un partener.', points: ['Experiențe personalizate', 'Artiști, decoruri, activări', 'Producție completă sau pe module', 'Un partener creativ și de încredere'], action: 'Continuă ca organizator', art: '↗' },
];

const app = document.querySelector('#app');
let step = 0;
let chosenRole = roles[0].id;
let installPrompt;

function route() {
  return location.pathname.replace(/\/+$/, '').endsWith('/admin') ? 'admin' : 'home';
}
function go(path) { history.pushState({}, '', path); render(); }
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function progress() { return `<div class="progress" aria-label="Pasul ${step + 1} din 5">${Array.from({ length: 4 }, (_, i) => `<i class="${i <= step - 1 ? 'on' : ''}"></i>`).join('')}</div>`; }
function art(className, text) { return `<div class="art ${className}" aria-hidden="true"><div class="art-glow"></div><div class="art-lines"></div><span>${text}</span><small>OAMENI · IDEI · ÎMPREUNĂ</small></div>`; }
function roleCard(role) { return `<article class="role-card ${role.color}"><div class="role-icon">${role.icon}</div><h2>${role.title}</h2><p>${role.intro}</p><ul>${role.points.map(p => `<li>${p}</li>`).join('')}</ul>${art(`role-art ${role.color}`, role.art)}<button class="primary role-submit" data-role="${role.id}">${role.action}<span>→</span></button></article>`; }

function render() {
  document.body.classList.toggle('admin-mode', route() === 'admin');
  app.innerHTML = route() === 'admin' ? adminView() : homeView();
  bind();
}
function homeView() {
  const pages = [
    `<section class="cover panel"><div class="cover-art">${art('cover-scene', '◌')}</div><div class="cover-shade"></div><div class="cover-copy"><div class="brand brand-light">Viziunea</div><p>Oameni<br> Spații<br> Idei<br> Împreună</p></div><div class="cover-note">A CREATIVE<br>HOSPITALITY STORY<br>IN PROGRESS</div><button class="round next" data-next aria-label="Începe">→</button></section>`,
    `<section class="panel about"><span class="eyebrow">Viziunea</span><h1>Un loc unde arta prinde viață împreună cu oamenii<span class="spark">✳</span></h1><p class="lead">Viziunea este un hub creativ cu spații, resurse și o comunitate care transformă idei în experiențe reale.</p>${art('sunset', '◡')}<button class="round next" data-next aria-label="Continuă">→</button></section>`,
    `<section class="panel what"><span class="eyebrow">Mai mult decât un spațiu.</span><h1>Un ecosistem creativ.</h1><div class="pill-grid">${[['⌂','Spații & locații','terracotta'],['◇','Ateliere & Academy','blue'],['⚙','Producție & scenografie','sage'],['✦','Evenimente & experiențe','purple'],['▣','Art & marketing','terracotta'],['✳','Natură & comunitate','sage']].map(x=>`<div class="pill ${x[2]}"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div><button class="round next" data-next aria-label="Continuă">→</button></section>`,
    `<section class="panel inside"><span class="eyebrow">Inima proiectului</span><h1>O comunitate de creație care construiește experiențe reale.</h1><div class="heart">♡</div><ul class="checks"><li>Oameni care se susțin</li><li>Spații pentru idei curajoase</li><li>Învățare prin practică</li><li>De la concept la realitate</li><li>Proiecte cu impact cultural și social</li></ul><button class="round next" data-next aria-label="Alege rolul">→</button></section>`,
    `<section class="panel choose"><span class="eyebrow">Cum vrei să continui?</span><h1>Alege rolul care ți se potrivește.</h1><p class="lead">Fiecare drum duce în aceeași direcție: mai multă artă în lume.</p><div class="role-links">${roles.map(r=>`<button class="role-link ${r.color}" data-role="${r.id}"><span>${r.icon}</span>${r.short}<b>›</b></button>`).join('')}</div></section>`,
  ];
  const content = step === 5 ? `<section class="panel roles-panel"><div class="roles-heading"><button class="text-button" data-prev>← Înapoi</button><span class="eyebrow">Alege drumul tău</span><h1>Locul tău e aici.</h1></div><div class="role-cards">${roles.map(roleCard).join('')}</div></section>` : pages[step];
  return `<header class="topbar"><a href="./" class="brand">Viziunea<span>✳</span></a><button class="text-button admin-link" data-admin>Admin ↗</button></header><main class="onboarding"><div class="step-label"><b>${step + 1}.</b> ${['COVER','DESPRE NOI','CE FACEM','INIMA PROIECTULUI','ALEGE ROLUL'][Math.min(step,4)]}</div>${content}<nav class="step-nav">${progress()}<button class="round nav-next" data-next aria-label="Pasul următor">→</button></nav></main><footer class="site-footer">© 2026 Viziunea <span>Făcută împreună, cu sens.</span></footer>`;
}

function adminView() {
  const list = getMembers();
  return `<header class="admin-top"><a href="./" class="brand">Viziunea<span>✳</span></a><span class="demo-badge">DEMO • date locale</span><button class="text-button" data-home>← Înapoi la site</button></header><main class="admin-wrap"><div class="admin-title"><div><span class="eyebrow">Spațiul echipei</span><h1>Administrare</h1><p>Gestionează membrii comunității și informațiile lor esențiale.</p></div><button class="primary" data-add>+ Adaugă membru</button></div><div class="stats"><div><span>Membri înregistrați</span><b>${list.length}</b></div><div><span>Roluri active</span><b>${new Set(list.map(m=>m.role)).size}</b></div><div><span>Ultimul membru</span><b>${list.length ? escapeHTML(list[list.length - 1].name.split(' ')[0]) : '—'}</b></div></div><section class="table-card"><div class="table-head"><div><h2>Membri</h2><span>Lista comunității Viziunea</span></div><label class="search">⌕ <input type="search" id="filter" placeholder="Caută membri" /></label></div><div class="table-scroll"><table><thead><tr><th>Membru</th><th>Rol</th><th>Email</th><th>Oraș</th><th>Status</th></tr></thead><tbody id="member-rows">${memberRows(list)}</tbody></table></div></section><p class="admin-hint">Această demonstrație salvează datele în browser. Schema Supabase pregătită pentru conectare se află în <code>supabase/schema.sql</code>.</p></main>`;
}
function memberRows(list) { return list.map(m=>`<tr><td><div class="person"><span>${escapeHTML(m.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase())}</span><b>${escapeHTML(m.name)}</b></div></td><td>${escapeHTML(roles.find(r=>r.id===m.role)?.short || m.role)}</td><td>${escapeHTML(m.email)}</td><td>${escapeHTML(m.city || '—')}</td><td><i class="status-dot"></i> ${escapeHTML(m.status || 'Activ')}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Nu există membri încă.</td></tr>`; }
function bind() {
  app.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{ step = Math.min(step + 1, 5); render(); window.scrollTo({top:0,behavior:'smooth'}); }));
  app.querySelectorAll('[data-prev]').forEach(b=>b.addEventListener('click',()=>{ step=4; render(); }));
  app.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{ chosenRole=b.dataset.role; showJoinForm(); }));
  app.querySelector('[data-admin]')?.addEventListener('click',()=>go('./admin'));
  app.querySelector('[data-home]')?.addEventListener('click',()=>go('./'));
  app.querySelector('[data-add]')?.addEventListener('click',showAdminForm);
  app.querySelector('#filter')?.addEventListener('input',e=>{ const q=e.target.value.toLowerCase(); app.querySelector('#member-rows').innerHTML=memberRows(getMembers().filter(m=>`${m.name} ${m.email} ${m.city} ${m.role}`.toLowerCase().includes(q))); });
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
  dialog.innerHTML=`<button class="dialog-close" aria-label="Închide">×</button><span class="eyebrow">Bun venit în Viziunea</span><h2>Hai să ne cunoaștem.</h2><p>Te înscrii ca <b>${role.title}</b>. Datele sunt folosite pentru a ține comunitatea conectată.</p><form id="join-form"><label>Numele tău<input name="name" autocomplete="name" required placeholder="Nume și prenume" /></label><label>Email<input name="email" type="email" autocomplete="email" required placeholder="tu@exemplu.ro" /></label><label>Orașul<input name="city" placeholder="De unde ești?" /></label><button class="primary" type="submit">Alătură-te comunității <span>→</span></button></form><div class="form-message" aria-live="polite"></div>`;
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('.dialog-close').onclick=()=>dialog.close(); dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').addEventListener('submit',async e=>{ e.preventDefault(); const data=Object.fromEntries(new FormData(e.target)); const message=dialog.querySelector('.form-message'); try { await saveMember({...data,role:chosenRole}); message.textContent='Mulțumim! Te-am adăugat în comunitatea Viziunea.'; e.target.reset(); } catch { message.textContent='Nu am putut salva înscrierea. Încearcă din nou.'; } });
}

window.addEventListener('popstate',render);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
render();
