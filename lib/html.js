/* lib/html.js — helpers HTML partagés entre le moteur (common.js) et les pages
   qui ne le chargent pas (history.html). Logique pure, double export comme les
   autres modules de lib/. */
(function(){
  /* échappement : tout texte saisi par l'utilisateur injecté en innerHTML
     passe par ici (noms de joueurs, historique importé…) */
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* pastille de couleur carrée alignée sur le texte (titres de cartes) */
  const sq = color =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};margin-right:7px"></span>`;

  const api = {esc, sq};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameHtml = api;
})();
