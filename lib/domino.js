/* lib/domino.js — partagé entre Kingdomino et Queendomino : les domaines
   (cases × couronnes). Barème du départage et relecture d'anciennes
   sauvegardes en logique pure ; le rendu de la liste et ses interactions
   (mêmes ids et data-attributes dans les deux pages) vivent ici pour
   n'exister qu'une fois. Double export comme les autres modules de lib/. */
(function(){
  /* Départage officiel des deux jeux : le plus grand domaine (en cases) */
  const maxDomaine = d => d.domaines.reduce((a,m)=>Math.max(a, +m.c||0), 0);

  /* relecture d'anciennes sauvegardes : toujours au moins une ligne de domaine */
  const fixupDomaines = d => { if(!Array.isArray(d.domaines) || !d.domaines.length) d.domaines = [{c:0,k:0}]; };

  const domsRankExtra = d => { const m = maxDomaine(d); return m ? ` · plus grand domaine ${m} cases` : ''; };
  const domsTiebreak = (a,b) => maxDomaine(b.d) - maxDomaine(a.d);

  /* HTML de la liste des domaines (chaîne pure) */
  const domsHtml = domaines => domaines.map((m,i)=>`
    <div class="row">
      <input class="num" data-dc="${i}" type="number" min="0" inputmode="numeric" value="${m.c}" style="width:58px" aria-label="cases du domaine">
      <span style="color:var(--muted);font-size:13px">cases ×</span>
      <input class="num" data-dk="${i}" type="number" min="0" inputmode="numeric" value="${m.k}" style="width:58px" aria-label="couronnes du domaine">
      <span class="val" data-dtot="${i}" style="flex:1;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">0</span>
      <button class="kill" data-deldom="${i}" aria-label="Supprimer ce domaine">×</button>
    </div>`).join('');

  /* Branchements de feuille (DOM) : la page fournit un conteneur #domList
     et étale ces fonctions dans sa config initSheet. */
  function domsDraw(d){ document.getElementById('domList').innerHTML = domsHtml(d.domaines); }
  function domsRefresh(d){
    document.querySelectorAll('[data-dtot]').forEach(el=>{
      const m = d.domaines[+el.dataset.dtot];
      el.textContent = m ? (+m.c||0)*(+m.k||0) : 0;
    });
  }
  function domsClick(e, ctx){
    const d = ctx.d;
    if(e.target.id === 'addDom'){ d.domaines.push({c:0,k:0}); domsDraw(d); ctx.refresh(); return true; }
    const del = e.target.closest('[data-deldom]');
    if(del){
      d.domaines.splice(+del.dataset.deldom,1);
      if(!d.domaines.length) d.domaines.push({c:0,k:0});
      domsDraw(d); ctx.refresh(); return true;
    }
    return false;
  }
  function domsInput(e, ctx){
    const d = ctx.d;
    if(e.target.dataset.dc !== undefined){ d.domaines[+e.target.dataset.dc].c = Math.max(0, +e.target.value||0); ctx.refresh(); return true; }
    if(e.target.dataset.dk !== undefined){ d.domaines[+e.target.dataset.dk].k = Math.max(0, +e.target.value||0); ctx.refresh(); return true; }
    return false;
  }

  const api = {maxDomaine, fixupDomaines, domsRankExtra, domsTiebreak, domsHtml, domsDraw, domsRefresh, domsClick, domsInput};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameDomino = api;
})();
