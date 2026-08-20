/* Logique de score Kingdomino — pure, sans DOM (navigateur + Node) */
(function(){
const blank = () => ({
  domaines:[{c:0,k:0}],         // un domaine = c cases × k couronnes
  harmonie:false, milieu:false, // variantes : +5 royaume complet, +10 château au centre
  defis:[0,0]                   // Age of Giants : points des 2 tuiles Défi tirées
});

/* exts.geants (Age of Giants) : 2 défis tirés par partie remplacent les bonus
   des variantes classiques (qui existent parmi les 17 tuiles Défi de la boîte) ;
   les couronnes couvertes par les géants ne se comptent pas — c'est au comptage
   visuel des couronnes, pas au barème. */
function score(d, opts){
  const exts = (opts && opts.exts) || {};
  const domaines = d.domaines.reduce((a,m)=>a + (+m.c||0)*(+m.k||0), 0);
  const geants = !!exts.geants;
  const bonus = geants ? 0 : (d.harmonie ? 5 : 0) + (d.milieu ? 10 : 0);
  const defis = geants ? (d.defis || []).reduce((a,v)=>a + (+v||0), 0) : 0;
  return {domaines, bonus, defis, total: domaines + bonus + defis};
}

/* relecture d'anciennes sauvegardes : domaines et défis toujours valides */
const fixup = d => {
  if(!Array.isArray(d.domaines) || !d.domaines.length) d.domaines = [{c:0,k:0}];
  if(!Array.isArray(d.defis) || d.defis.length !== 2) d.defis = [0,0];
};

const maxPlayers = exts => exts && exts.geants ? 5 : 4; // Age of Giants ajoute un 5e joueur

/* Le départage (plus grand domaine) est partagé avec Queendomino : lib/domino.js */
const api = {blank, score, fixup, maxPlayers};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
