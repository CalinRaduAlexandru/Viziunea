const CACHE='viziunea-static-v17';
const SHELL=['./','./index.html','./admin/','./auth/','./styles.css','./entry.css','./viewport.css','./assets-layout.css','./manifest.webmanifest','./src/main.js','./src/config.js','./src/views/orientation.js','./src/services/members.js','./src/services/supabase.js','./src/services/auth.js','./src/services/demo-data.js','./src/services/directory.js','./src/services/needs.js','./src/services/suggestions.js','./src/services/notifications.js','./assets/icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{
  const files=await Promise.all(SHELL.map(async url=>{
    const response=await fetch(new Request(url,{cache:'reload'}));
    if(!response.ok)throw new Error(`Cache refresh failed for ${url}`);
    await cache.put(url,response);
  }));
  return files;
}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(async response=>{
    if(response.ok){const copy=response.clone();await caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(async()=>await caches.match(event.request)||Response.error()));
});
