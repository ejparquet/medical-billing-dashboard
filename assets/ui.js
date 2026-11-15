/* Small helpers shared by the sub-pages (work queue, client report). */
window.UI = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const money = (v, d = 0) => '$' + (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(d || 0) + 'K' : Math.round(v).toLocaleString());
  const moneyFull = v => '$' + Math.round(v).toLocaleString();
  // Table amounts: always in thousands so a column reads consistently ($5.6K, $11K, $1.2M).
  const moneyK = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + (v / 1e3).toFixed(v < 1e4 ? 1 : 0) + 'K';
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const chip = (kind, icon, text) => `<span class="chip chip-${kind}"><svg><use href="#i-${icon}"/></svg>${text}</span>`;
  const TODAY = new Date(2026, 9, 19);
  const dayStr = off => { const d = new Date(TODAY); d.setDate(d.getDate() + off); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const mask = name => name.split(' ').map(w => w[0] + '•••').join(' ');
  const param = k => new URLSearchParams(location.search).get(k);

  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.innerHTML = `<svg width="16" height="16" style="color: var(--good)"><use href="#i-check"/></svg>${msg}`;
    t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2800);
  };
  const download = (name, rows) => {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // Light/dark switch: follows the OS until the viewer picks, then remembers the choice.
  const initTheme = () => {
    const sw = $('#themeSwitch'); if (!sw) return;
    const sys = matchMedia('(prefers-color-scheme: dark)');
    const cur = () => document.documentElement.dataset.theme || (sys.matches ? 'dark' : 'light');
    const sync = () => { sw.dataset.on = cur(); $$('[data-theme-set]').forEach(b => b.setAttribute('aria-checked', b.dataset.themeSet === cur())); };
    const set = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('ll-theme', t); } catch (e) {} sync(); };
    $$('[data-theme-set]').forEach(b => b.addEventListener('click', () => set(b.dataset.themeSet)));
    sw.addEventListener('keydown', e => { if (!e.key.startsWith('Arrow')) return; e.preventDefault(); set(cur() === 'dark' ? 'light' : 'dark'); $(`[data-theme-set="${cur()}"]`).focus(); });
    sys.addEventListener('change', sync); sync();
  };

  const themeSwitchHtml = `<div class="theme-switch" id="themeSwitch" role="radiogroup" aria-label="Color theme"><span class="thumb" aria-hidden="true"></span>
    <button role="radio" data-theme-set="light" aria-checked="false" aria-label="Light mode"><svg><use href="#i-sun"/></svg><span class="hidden sm:inline">Light</span></button>
    <button role="radio" data-theme-set="dark" aria-checked="false" aria-label="Dark mode"><svg><use href="#i-moon"/></svg><span class="hidden sm:inline">Dark</span></button></div>`;

  return { $, $$, money, moneyK, moneyFull, pct, esc, chip, dayStr, mask, param, toast, download, initTheme, themeSwitchHtml };
})();
