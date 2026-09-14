const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const titleCase = value => String(value || '').replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase());
const safeLink = value => { try { const url=new URL(value); return ['https:','http:'].includes(url.protocol)?h(url.href):''; } catch { return ''; } };

export const INTENTS = [
  {id:'create',label:'Vreau să creez ceva',icon:'✳'},
  {id:'find',label:'Caut ceva',icon:'⌕'},
  {id:'offer',label:'Am ceva de oferit',icon:'↗'},
  {id:'learn',label:'Vreau să învăț',icon:'⌂'},
  {id:'participate',label:'Vreau să particip / să descopăr',icon:'◌'},
  {id:'organize',label:'Vreau să organizez ceva',icon:'◇'},
  {id:'unsure',label:'Nu știu încă',icon:'…'},
];

export function renderIntentStep(selected) {
  return `<section class="panel intent-step"><span class="eyebrow">Pornim de la ce ai nevoie acum</span><h1>Ce te aduce la Viziunea?</h1><p class="lead">Poți explora direcții diferite oricând. Intenția ta nu îți fixează un rol.</p><div class="intent-list">${INTENTS.map(item=>`<button class="intent-option ${selected===item.id?'selected':''}" data-intent="${item.id}" aria-pressed="${selected===item.id}"><span>${item.icon}</span><b>${item.label}</b><i>${selected===item.id?'✓':'→'}</i></button>`).join('')}</div><button class="primary intent-continue" data-intent-continue ${selected?'':'disabled'}>Continuă <span>→</span></button></section>`;
}

function locationText(item) {
  const place=[item.location_label,item.city,item.county,item.region].filter(Boolean).join(' · ');
  const mode=item.location_mode;
  if(mode==='remote'||mode==='location_independent') return mode==='remote'?'Online · remote':'Fără limită geografică';
  return [place,item.service_area_scope==='national'?'acoperire națională':item.service_area_scope==='online'?'online':null].filter(Boolean).join(' · ') || 'Locație flexibilă';
}

function flowHeader(user, count, demo) {
  return `<header class="flow-header"><a href="./" class="brand" data-flow-home>Viziunea<span>✳</span></a>${demo?'<span class="demo-badge flow-demo">DEMO</span>':''}<nav><button data-flow="community">Comunitatea caută</button><button data-flow="my-needs">Nevoile mele</button><button data-flow="notifications">${count?`Notificări · ${count}`:'Notificări'}</button>${user?`<button data-sign-out class="flow-user" aria-label="Ieși din cont">${h(user.email || 'Cont')} · Ieși</button>`:`<button data-auth-go class="flow-user">Cont</button>`}</nav></header>`;
}

function searchForm(state) {
  return `<form class="orientation-form" id="orientation-search"><label for="need-query">Ce cauți?</label><textarea id="need-query" name="query" required minlength="2" maxlength="500" placeholder="${h(state.placeholder || 'Ex.: un fotograf pentru un proiect')}" rows="2">${h(state.query)}</textarea><span class="eyebrow">Poți descrie în cuvintele tale; noi găsim domeniul și tipul de ajutor.</span><div class="geo-inputs"><label>Orașul tău (opțional)<input name="city" value="${h(state.city)}" placeholder="Constanța" autocomplete="address-level2"></label><label>Județul (opțional)<input name="county" value="${h(state.county)}" placeholder="Constanța" autocomplete="address-level1"></label><label>Regiunea (opțional)<input name="region" value="${h(state.region||'')}" placeholder="Sud-Est"></label><label>Țara<input name="country" value="${h(state.country||'România')}" placeholder="România"></label></div><div class="preference-row"><label>Preferință geografică<select name="location_preference"><option value="flexible" ${state.locationPreference==='flexible'?'selected':''}>Flexibilă</option><option value="fixed" ${state.locationPreference==='fixed'?'selected':''}>Vreau să fie local / la locație</option><option value="travels" ${state.locationPreference==='travels'?'selected':''}>Furnizorul se poate deplasa</option><option value="remote" ${state.locationPreference==='remote'?'selected':''}>Remote este în regulă</option><option value="hybrid" ${state.locationPreference==='hybrid'?'selected':''}>Hibrid</option></select></label><label class="remote-check"><input type="checkbox" name="remote_ok" ${state.remoteOk?'checked':''}> Pot lua în calcul remote</label></div><label class="distance-field">Distanță maximă (km, opțional)<input name="max_distance_km" inputmode="numeric" type="number" min="1" max="2000" value="${h(state.maxDistance)}" placeholder="Fără limită indicată"></label><button class="primary" type="submit">Caută în Viziunea <span>→</span></button></form>`;
}

function needCard(need, actions = true) {
  const place=[need.city,need.county,need.region].filter(Boolean).join(', ');
  const mode=need.location_preference;
  const loc=mode==='remote'?'Remote este în regulă':mode==='location_independent'?'Fără limită geografică':mode==='travels'?[place,'Furnizorul se poate deplasa'].filter(Boolean).join(' · '):mode==='hybrid'?[place,'hibrid'].filter(Boolean).join(' · '):place;
  return `<article class="community-need"><div class="need-meta"><span>${h(titleCase(need.intent))}</span><time>${new Date(need.created_at).toLocaleDateString('ro-RO')}</time></div><h2>Cineva caută ${h(need.query)}</h2>${loc?`<p class="need-location">${h(loc)}</p>`:''}${need.max_distance_km?`<p class="need-location">Distanță maximă preferată: ${h(need.max_distance_km)} km</p>`:''}${actions?`<div class="need-actions"><button class="secondary" data-suggest="${h(need.id)}">Sugerează pe cineva</button><button class="primary" data-help="${h(need.id)}">Pot ajuta eu <span>→</span></button></div>`:''}</article>`;
}

function renderSearch(state) {
  return `<section class="flow-content search-view"><button class="quiet-back" data-intro-intent>← Înapoi la intenție</button><span class="eyebrow">${h(titleCase(state.intent))} · orientare</span><h1>Ce cauți?</h1><p class="lead">Spune-ne ce ți-ar fi de folos acum.</p>${state.error?`<p class="flow-error">${h(state.error)}</p>`:''}${searchForm(state)}<button class="flow-link" data-flow="community">Vezi ce caută comunitatea <span>→</span></button></section>`;
}

function renderResults(state) {
  const count=state.results.length;
  const place=[state.city,state.county,state.region].filter(Boolean)[0];
  const stage={city:place?`în ${place}`:'în director',nearby:'în apropiere',county:state.county?`în județul ${state.county}`:'în județ',region:state.region?`în regiunea ${state.region}`:'în regiune',national:'cu acoperire națională',online:'online'}[state.scope] || '';
  const next=place?{city:['nearby','Vrei să căutăm și în apropiere?'],nearby:['county','Extindem la tot județul?'],county:['region','Extindem la regiune?'],region:['national','Căutăm și servicii cu acoperire națională?']}[state.scope]:null;
  return `<section class="flow-content results-view"><button class="quiet-back" data-flow="search">← Schimbă căutarea</button><span class="eyebrow">${count?`${count} ${count===1?'sugestie':'sugestii'} ${h(stage)}`:'Nu am găsit încă potriviri'}${count?' · '+h(state.scopeLabel||'') :''}</span><h1>${count?'Am găsit câteva sugestii pentru tine.':'Nu avem încă o sugestie suficient de bună.'}</h1>${state.error?`<p class="flow-error">${h(state.error)}</p>`:''}${count?`<div class="directory-results">${state.results.map(({item,geography})=>`<article class="directory-result"><div class="result-heading"><span>${h(titleCase(item.item_type))} · ${h(titleCase(item.domain))}</span><span>${h(item.value_type.replaceAll('_',' '))}</span></div><h2>${h(item.title)}</h2><p>${h(item.description)}</p><div class="result-geo">${h(geography.reason || locationText(item))}</div><button class="flow-link" data-item-details="${h(item.id)}">Detalii <span>→</span></button></article>`).join('')}</div><button class="secondary no-match" data-no-match>Nu e ce căutam</button>`:`<p class="lead">Poți extinde zona de căutare sau ne poți anunța dacă apare o variantă potrivită.</p><button class="primary" data-create-need>Anunță-mă dacă apar sugestii <span>→</span></button>`}${next?`<div class="progressive-location"><p>${h(next[1])}</p><button class="flow-link" data-expand-scope="${next[0]}">Extinde căutarea <span>→</span></button></div>`:''}<button class="flow-link" data-flow="community">Comunitatea caută <span>→</span></button></section>`;
}

function renderCommunity(state) {
  return `<section class="flow-content community-view"><button class="quiet-back" data-flow="search">← Înapoi la căutare</button><span class="eyebrow">Ajutorul se poate întoarce în comunitate</span><h1>Comunitatea caută</h1><p class="lead">Nevoile sunt afișate anonim. Numele și datele de contact ale solicitantului nu apar aici.</p>${state.error?`<p class="flow-error">${h(state.error)}</p>`:''}<div class="community-list">${state.needs.length?state.needs.map(need=>needCard(need)).join(''):'<p class="empty-state">Nu sunt nevoi deschise momentan.</p>'}</div></section>`;
}

function renderNeeds(state) {
  return `<section class="flow-content personal-view"><span class="eyebrow">Contul tău</span><h1>Nevoile mele</h1>${state.message?`<p class="success-message">${h(state.message)}</p>`:''}${state.user?`<p class="lead">${h(state.user.email)}</p>`:`<p class="lead">Autentifică-te pentru a vedea cererile tale și răspunsurile aprobate.</p><button class="primary" data-auth-go>Continuă cu emailul <span>→</span></button>`}${state.error?`<p class="flow-error">${h(state.error)}</p>`:''}<div class="personal-list">${state.user?(state.needs.length?state.needs.map(need=>`<article class="personal-need">${needCard(need,false)}<div class="need-state">Status: ${h(titleCase(need.status))}</div>${need.status==='open'?`<button class="flow-link" data-resolve-need="${h(need.id)}">Marchează ca rezolvată <span>✓</span></button>`:''}${(state.approvedByNeed?.[need.id]||[]).map(s=>`<div class="approved-suggestion"><span class="eyebrow">Sugestie aprobată</span><h3>${h(s.name)}</h3><p>${h(s.description)}</p>${safeLink(s.contact_url)?`<a href="${safeLink(s.contact_url)}" target="_blank" rel="noopener">Deschide contactul ↗</a>`:''}</div>`).join('')}</article>`).join(''):'<p class="empty-state">Încă nu ai nevoi salvate.</p>'):''}</div></section>`;
}

function renderSuggestions(state) {
  return `<section class="flow-content personal-view"><span class="eyebrow">Contribuțiile tale</span><h1>Sugestiile mele</h1>${state.message?`<p class="success-message">${h(state.message)}</p>`:''}${state.user?`<div class="personal-list">${state.suggestions.length?state.suggestions.map(s=>`<article class="approved-suggestion"><span class="eyebrow">${h(titleCase(s.status))}</span><h3>${h(s.name)}</h3><p>${h(s.description)}</p></article>`).join(''):'<p class="empty-state">Încă nu ai trimis sugestii.</p>'}</div>`:`<p class="lead">Autentifică-te pentru a vedea sugestiile trimise.</p><button class="primary" data-auth-go>Continuă cu emailul <span>→</span></button>`}</section>`;
}

function renderNotifications(state) {
  return `<section class="flow-content personal-view"><span class="eyebrow">Vești despre nevoile tale</span><h1>Notificări</h1>${state.user?`<div class="personal-list">${state.notifications.length?state.notifications.map(n=>`<button class="notification ${n.read_at?'read':''}" data-notification="${h(n.id)}" data-notification-need="${h(n.need_id||'')}"><span class="eyebrow">${new Date(n.created_at).toLocaleDateString('ro-RO')}</span><b>${h(n.title)}</b><span>${h(n.body)}</span></button>`).join(''):'<p class="empty-state">Momentan nu ai notificări.</p>'}</div>`:`<p class="lead">Autentifică-te pentru notificări despre soluțiile aprobate.</p><button class="primary" data-auth-go>Continuă cu emailul <span>→</span></button>`}</section>`;
}

function renderSuggestionForm(state) {
  const need=state.activeNeed;
  return `<section class="flow-content suggestion-view"><button class="quiet-back" data-flow="community">← Înapoi la comunitate</button><span class="eyebrow">O soluție poate începe cu un om</span><h1>Poți ajuta?</h1>${need?`<p class="lead">Cineva caută ${h(need.query)}${need.city?` · ${h(need.city)}`:''}</p>`:''}${state.error?`<p class="flow-error">${h(state.error)}</p>`:''}<form class="orientation-form" id="suggestion-form"><label>Ce poți propune?<select name="suggestion_type"><option value="referral" ${state.suggestionType==='referral'?'selected':''}>Sugerează pe cineva sau o resursă</option><option value="self" ${state.suggestionType==='self'?'selected':''}>Pot ajuta eu</option></select></label><label>Nume soluție / persoană<input name="name" required minlength="2" maxlength="180" placeholder="Numele persoanei, serviciului sau resursei"></label><label>De ce se potrivește?<textarea name="description" required minlength="2" maxlength="1000" rows="3" placeholder="Câteva detalii utile"></textarea></label><label>Link de contact (opțional)<input name="contact_url" type="url" placeholder="https://"></label><button class="primary" type="submit">Trimite spre moderare <span>→</span></button><p class="eyebrow">Sugestia nu ajunge direct la solicitant. Echipa Viziunea o verifică mai întâi.</p></form></section>`;
}

function renderDetails(state) {
  const item=state.activeItem;
  return `<section class="flow-content details-view"><button class="quiet-back" data-flow="results">← Înapoi la sugestii</button>${item?`<span class="eyebrow">${h(titleCase(item.item_type))} · ${h(titleCase(item.domain))}</span><h1>${h(item.title)}</h1><p class="lead">${h(item.description)}</p><p class="detail-geo">${h(locationText(item))}</p><div class="tag-list">${(item.tags||[]).map(tag=>`<span>${h(tag)}</span>`).join('')}</div>${safeLink(item.contact_url)?`<a class="primary contact-link" href="${safeLink(item.contact_url)}" target="_blank" rel="noopener">Vezi detalii <span>↗</span></a>`:''}`:'<p class="empty-state">Sugestia nu mai este disponibilă.</p>'}</section>`;
}

export function renderFlowView(state) {
  const content={search:()=>renderSearch(state),results:()=>renderResults(state),unmatched:()=>renderResults({...state,results:[]}),community:()=>renderCommunity(state), 'my-needs':()=>renderNeeds(state),'my-suggestions':()=>renderSuggestions(state),notifications:()=>renderNotifications(state),suggestion:()=>renderSuggestionForm(state),details:()=>renderDetails(state)}[state.screen] || (()=>renderSearch(state));
  return `${flowHeader(state.user,state.unreadCount||0,state.demoMode)}<main class="flow-view" data-screen="${h(state.screen)}">${content()}</main>`;
}

export function renderItemDialog(item) {
  if (!item) return '';
  return `<dialog class="join-dialog ecosystem-dialog item-dialog"><button class="dialog-close" data-close-dialog aria-label="Închide">×</button><span class="eyebrow">${h(titleCase(item.item_type))} · ${h(titleCase(item.domain))}</span><h2>${h(item.title)}</h2><p>${h(item.description)}</p><p class="detail-geo">${h(locationText(item))}</p>${safeLink(item.contact_url)?`<a class="primary" href="${safeLink(item.contact_url)}" target="_blank" rel="noopener">Vezi detalii <span>↗</span></a>`:''}<button class="primary ecosystem-understood" data-close-dialog>Am înțeles</button></dialog>`;
}

export function anonymizeNeedText(value='') {
  return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email eliminat]').replace(/https?:\/\/\S+/gi,'[link eliminat]').replace(/\+?[0-9][0-9 ().-]{6,}[0-9]/g,'[telefon eliminat]');
}
