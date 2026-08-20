/* lib/manches.js — partagé entre les jeux à manches cumulées (Sea Salt & Paper,
   Skyjo) : la liste des manches validées (rendu, édition, suppression), le
   rankExtra « N manches » et le bandeau de fin de partie. Comme lib/domino.js,
   la partie pure vit en haut, les branchements DOM en bas (mêmes ids et
   data-attributes dans les deux pages). Le cumul lui-même reste dans chaque
   games/<jeu>.js (les modules de jeux ne dépendent de rien).
   signed : autorise les manches négatives (Skyjo, cartes de −2 à 12). */
(function(){
  const manchesRankExtra = d => d.manches.length
    ? ` · ${d.manches.length} manche${d.manches.length > 1 ? 's' : ''}` : '';

  /* mutations pures (Node/Expo) — le rendu ci-dessous les appelle */
  const delManche = (d, i) => { d.manches.splice(i, 1); };
  const setManche = (d, i, v, signed) => { d.manches[i] = signed ? (+v||0) : Math.max(0, +v||0); };

  /* HTML de la liste des manches (chaîne pure) */
  const manchesHtml = (manches, signed) => manches.map((m,i)=>`
    <div class="row">
      <div class="lab">Manche ${i+1}</div>
      <input class="num num-m" data-manche="${i}" type="number" ${signed?'':'min="0" inputmode="numeric" '}value="${+m||0}" aria-label="score de la manche ${i+1}">
      <button class="kill" data-delmanche="${i}" aria-label="Supprimer la manche ${i+1}">×</button>
    </div>`).join('')
    || '<p class="hint">Aucune manche validée pour l\'instant.</p>';

  /* Branchements de feuille (DOM) : la page fournit un conteneur #mancheList
     et étale manchesFor(signed) — les trois hooks préconfigurés, le drapeau
     signed n'est passé qu'une fois. */
  function manchesDraw(d, signed){
    document.getElementById('mancheList').innerHTML = manchesHtml(d.manches, signed);
  }
  const manchesFor = signed => ({
    manchesDraw: d => manchesDraw(d, signed),
    manchesClick(e, ctx){
      const del = e.target.closest('[data-delmanche]');
      if(del){
        delManche(ctx.d, +del.dataset.delmanche);
        manchesDraw(ctx.d, signed); ctx.refresh(); return true;
      }
      return false;
    },
    manchesInput(e, ctx){
      if(e.target.dataset.manche !== undefined){
        setManche(ctx.d, +e.target.dataset.manche, e.target.value, signed);
        ctx.refresh(); return true;
      }
      return false;
    }
  });
  /* Bandeau de fin de partie : seul le cumul des manches validées doit compter
     (le prédicat atteint(p) reçoit chaque joueur), la manche en cours jamais. */
  function manchesFin(id, players, atteint, texte){
    const el = document.getElementById(id);
    if(!el) return;
    const noms = players.filter(atteint).map(p => p.nom);
    el.hidden = !noms.length;
    el.textContent = noms.length ? texte(noms) : '';
  }

  const api = {manchesRankExtra, manchesHtml, manchesFor, manchesFin, delManche, setManche};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameManches = api;
})();
