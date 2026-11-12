/* lib/html.js — helpers HTML partagés entre le moteur (common.js) et les pages
   qui ne le chargent pas (history.html). Logique pure, double export comme les
   autres modules de lib/. */
(function(){
  /* échappement : tout texte saisi par l'utilisateur injecté en innerHTML
     passe par ici (noms de joueurs, historique importé…) */
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* pastille de couleur carrée alignée sur le texte (titres de cartes) :
     la forme vit dans common.css (.sw), seule la couleur est inline */
  const sq = color =>
    `<span class="sw" style="background:${color}"></span>`;

  const api = {esc, sq};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameHtml = api;
})();
