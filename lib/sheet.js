/* lib/sheet.js — la partie pure du moteur de feuille (common.js) : relecture
   des sauvegardes, classement avec ex æquo, entrée d'historique et texte de
   partage. Sans DOM, double export : testable en Node et réutilisable hors
   navigateur (préparation Expo). */
(function(){
  /* Normalise le `d` d'un joueur relu depuis une sauvegarde : les clés
     manquantes prennent la valeur vierge, et les tableaux de forme FIXE de
     blank() (arbre:[0,0,0], defis:[0,0]…) sont réalignés (longueur et nombres)
     — un tableau abîmé ferait afficher « undefined » et un total NaN. Les
     tableaux variables ([], [{…}]) restent aux fixup des jeux. */
  function normalizeD(blank, d){
    const out = {...blank, ...(d || {})};
    for(const k of Object.keys(blank)){
      const b = blank[k];
      if(!Array.isArray(b)) continue;
      if(!Array.isArray(out[k])) out[k] = b;
      if(b.length && b.every(v => typeof v === 'number'))
        out[k] = b.map((_, i) => +out[k][i] || 0);
      else if(out[k] === b) out[k] = JSON.parse(JSON.stringify(b)); // jamais partager la forme vierge
    }
    return out;
  }

  /* Classement « competition ranking » (1,1,3) : total puis départage du jeu ;
     deux voisins que le comparateur ne sépare pas partagent la même position —
     l'ordre d'entrée ne fabrique jamais un vainqueur. lowWins inverse le sens
     (le plus petit total gagne). tiebreak(a, b) ne lit que a.d/a.s et b.d/b.s. */
  const rankCmp = (lowWins, tiebreak) =>
    (a, b) => (lowWins ? a.s.total - b.s.total : b.s.total - a.s.total)
      || (tiebreak ? tiebreak(a, b) : 0);

  function positions(list, cmp){
    const pos = [];
    for(let i = 0; i < list.length; i++)
      pos[i] = i > 0 && cmp(list[i-1], list[i]) === 0 ? pos[i-1] : i + 1;
    return pos;
  }

  /* L'unique constructeur de classement (archive, panneau, texte partagé) :
     trie les items ({s, ...} avec s.total) et leur adjoint pos. */
  function ranked(items, {lowWins, tiebreak} = {}){
    const cmp = rankCmp(lowWins, tiebreak);
    const sorted = [...items].sort(cmp);
    const pos = positions(sorted, cmp);
    return sorted.map((it, i) => ({...it, pos: pos[i]}));
  }

  /* Entrée d'historique (scores-history-v1) d'une partie terminée : la
     ventilation ([libellé, valeur]) et la position sont figées — l'historique
     ne sait recalculer ni un barème ni un départage. pos seulement quand elle
     dévie du rang (ex æquo) ; champs additifs, les anciennes entrées restent
     valides. list : le résultat de ranked(). */
  function archiveEntry(list, {slug, t, exts, rankParts, rankExtra}){
    const players = list.map((it, i) => {
      const entry = {nom: it.nom, total: it.s.total};
      if(it.pos !== i + 1) entry.pos = it.pos;
      const parts = rankParts(it.s, it.d).filter(x => x[1]);
      if(parts.length) entry.parts = parts;
      const extra = rankExtra ? rankExtra(it.d) : '';
      if(extra) entry.extra = extra;
      return entry;
    });
    return {g: slug, t, players, ...(exts && exts.length ? {exts} : {})};
  }

  /* Texte du classement pour partage : jeu, extensions actives, date, puis une
     ligne par joueur — mêmes positions que le panneau, 🏆 pour chaque
     vainqueur. En solo, pas de position. */
  function shareText(list, {gameName, exts, date}){
    return gameName + (exts && exts.length ? ' (' + exts.join(', ') + ')' : '')
      + ' — ' + date + '\n'
      + list.map(it =>
          (list.length > 1 ? (it.pos === 1 ? '🏆 ' : it.pos + '. ') : '')
          + it.nom + ' — ' + it.s.total + ' pts').join('\n');
  }

  const api = {normalizeD, rankCmp, positions, ranked, archiveEntry, shareText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameSheet = api;
})();
