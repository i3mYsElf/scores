/* Harnais partagé des tests — pas un fichier de tests (node --test ne le
   lance pas : il ne matche pas *.test.js). loadPage charge une page HTML
   réelle dans jsdom et exécute ses scripts dans l'ordre du document (les src
   relus depuis le disque, évalués via window.eval — c'est ce qui couvre les
   scripts inline des pages, qu'ESLint ne voit pas). Chaque fichier de tests
   jsdom déclare test.afterEach(closeAll) pour libérer fenêtres et timers. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const open = [];
function loadPage(file, storage) {
  const dom = new JSDOM(read(file), { url: 'http://localhost/' + file, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  open.push(window);
  window.confirm = () => true; // jsdom ne l'implémente pas (falsy) — accepter par défaut
  for (const [k, v] of Object.entries(storage || {})) window.localStorage.setItem(k, v);
  for (const s of window.document.querySelectorAll('script')) {
    const code = s.src ? read(new URL(s.src).pathname) : s.textContent;
    window.eval(code);
  }
  return window;
}
const closeAll = () => { for (const w of open.splice(0)) try { w.close(); } catch { /* déjà fermée */ } };
const click = (w, sel) => w.document.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const type = (w, sel, val) => {
  const el = w.document.querySelector(sel);
  el.value = val;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
};
const grand = w => w.document.getElementById('grand').textContent;

module.exports = {ROOT, read, loadPage, closeAll, click, type, grand};
