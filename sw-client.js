/* sw-client.js — enregistrement du service worker + bannière de mise à jour.
   Chargé (defer) par toutes les pages. Une nouvelle version du SW n'est activée
   qu'à la demande de l'utilisateur (message SKIP_WAITING envoyé au clic sur
   « Recharger ») : on évite qu'une page ouverte mélange l'ancien HTML et les
   nouveaux assets en cours de partie. */
(function(){
  // demande au navigateur de ne pas évincer le stockage (parties en cours, historique)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});

  if (!('serviceWorker' in navigator)) return;

  function offerUpdate(reg){
    if (document.getElementById('swUpdate')) return;
    document.body.insertAdjacentHTML('beforeend',
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
    }).catch(()=>{});

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
})();
