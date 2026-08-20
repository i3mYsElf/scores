/* sw-client.js — enregistrement du service worker + bannière de mise à jour.
   Chargé (defer) par toutes les pages. Une nouvelle version du SW n'est activée
   qu'à la demande de l'utilisateur (message SKIP_WAITING envoyé au clic sur
   « Recharger ») : on évite qu'une page ouverte mélange l'ancien HTML et les
   nouveaux assets en cours de partie. */
(function(){
  // demande au navigateur de ne pas évincer le stockage (parties en cours, historique)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});

  if (!('serviceWorker' in navigator)) return;

  /* conteneur commun des bannières (partagé avec common.js, même id) :
     elles s'empilent au lieu de se recouvrir */
  function bannerHost(){
    let b = document.getElementById('banners');
    if (!b){
      b = document.createElement('div');
      b.id = 'banners'; b.className = 'banners';
      document.body.appendChild(b);
    }
    return b;
  }

  function offerUpdate(reg){
    if (document.getElementById('swUpdate')) return;
    bannerHost().insertAdjacentHTML('beforeend',
      `<div class="sw-update" id="swUpdate" role="status">Nouvelle version disponible
         <button id="swReload" type="button">Recharger</button></div>`);
    document.getElementById('swReload').addEventListener('click', ()=>{
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    });
  }

  addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).then(reg=>{
      // une version déjà en attente (téléchargée lors d'une visite précédente)
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg);
      reg.addEventListener('updatefound', ()=>{
        const w = reg.installing;
        if (!w) return;
        // controller absent = première installation : rien à proposer
        w.addEventListener('statechange', ()=>{
          if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(reg);
        });
      });
      // PWA laissée ouverte plusieurs jours : re-vérifier au retour au premier plan
      document.addEventListener('visibilitychange', ()=>{
        if (document.visibilityState === 'visible') reg.update().catch(()=>{});
      });
    }).catch(()=>{});

    /* clients.claim() du premier SW déclenche controllerchange sur une page qui
       n'était pas encore contrôlée : ne recharger que sur une vraie mise à jour */
    let controlled = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if (!controlled){ controlled = true; return; }
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
})();
