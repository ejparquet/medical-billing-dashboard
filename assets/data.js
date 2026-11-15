/* Ledgerline demo data — shared by every page.
   Seeded, so each page generates the identical practices, payers and claims.
   No real patient information. */
(() => {
  /* ================= Demo data ================= */
  let seed = 20261019;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + rnd() * (b - a);

  const MONTHS = ['Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'];
  const YEARS  = [2025,2025,2026,2026,2026,2026,2026,2026,2026,2026,2026,2026];

  const CLIENTS = [
    { id: 'cedar',   name: 'Cedar Ridge Family Medicine', short: 'Cedar Ridge',  spec: 'Primary care',      pm: 'athenaOne',     base: 182000, den: .062, ar: 34, auth: .9 },
    { id: 'harbor',  name: 'Harbor Orthopedics',          short: 'Harbor Ortho', spec: 'Orthopedics',       pm: 'ModMed',        base: 341000, den: .118, ar: 47, auth: 2.4 },
    { id: 'lumen',   name: 'Lumen Pediatrics',            short: 'Lumen Peds',   spec: 'Pediatrics',        pm: 'Office Ally',   base: 126000, den: .048, ar: 29, auth: .6 },
    { id: 'north',   name: 'Northgate Cardiology',        short: 'Northgate',    spec: 'Cardiology',        pm: 'eClinicalWorks',base: 288000, den: .094, ar: 44, auth: 2.0 },
    { id: 'sierra',  name: 'Sierra Physical Therapy',     short: 'Sierra PT',    spec: 'Physical therapy',  pm: 'WebPT',         base: 98000,  den: .081, ar: 38, auth: 1.5 },
    { id: 'willow',  name: 'Willow Behavioral Health',    short: 'Willow BH',    spec: 'Behavioral health', pm: 'SimplePractice',base: 74000,  den: .132, ar: 58, auth: 1.3 },
    { id: 'bayview', name: 'Bayview Dermatology',         short: 'Bayview Derm', spec: 'Dermatology',       pm: 'ModMed',        base: 156000, den: .057, ar: 31, auth: .8 },
  ];
  const PAYERS = [
    { n: 'Medicare',          tf: 365, appeal: 120, dtp: 14 },
    { n: 'Medicaid (state)',  tf: 180, appeal: 90,  dtp: 31 },
    { n: 'BCBS',              tf: 180, appeal: 180, dtp: 19 },
    { n: 'UnitedHealthcare',  tf: 90,  appeal: 180, dtp: 24 },
    { n: 'Aetna',             tf: 120, appeal: 180, dtp: 22 },
    { n: 'Cigna',             tf: 90,  appeal: 180, dtp: 21 },
    { n: 'Humana',            tf: 180, appeal: 60,  dtp: 27 },
  ];
  const REASONS = [
    { k: 'auth',  label: 'Prior authorization', code: 'CO-197' },
    { k: 'nec',   label: 'Medical necessity',   code: 'CO-50'  },
    { k: 'elig',  label: 'Eligibility',         code: 'CO-27'  },
    { k: 'code',  label: 'Coding & bundling',   code: 'CO-97'  },
    { k: 'info',  label: 'Missing info',        code: 'CO-16'  },
  ];

  // Monthly series per client
  CLIENTS.forEach(c => {
    c.months = MONTHS.map((m, i) => {
      const season = 1 + .06 * Math.sin((i + 2) / 12 * Math.PI * 2);
      const growth = 1 + i * .008;
      const charges = c.base * season * growth * between(.93, 1.07);
      const allowed = charges * between(.5, .56);
      const collected = allowed * between(.93, .985) * (i === 11 ? .62 : 1);  // Oct is month-to-date
      const claims = Math.round(charges / between(310, 360));
      const trend = i >= 6 ? 1 + (i - 6) * .04 * (c.auth > 1.4 ? 1 : .2) : 1;
      const denRate = c.den * between(.88, 1.12) * trend;
      const denied = Math.round(claims * denRate);
      const w = { auth: c.auth * trend * (i > 7 ? 1.15 : 1), nec: 1.1, elig: 1, code: .9, info: .8 };
      const tot = Object.values(w).reduce((a, b) => a + b, 0);
      const byReason = {}; let used = 0;
      REASONS.forEach((r, j) => { const v = j === REASONS.length - 1 ? denied - used : Math.round(denied * w[r.k] / tot); byReason[r.k] = Math.max(0, v); used += byReason[r.k]; });
      return { charges, allowed, collected, claims, denied, byReason };
    });
    const total = c.base * c.ar / 30 * between(.95, 1.05);
    const mix = c.ar > 45 ? [.36, .21, .14, .11, .18] : c.ar > 35 ? [.46, .22, .12, .08, .12] : [.55, .23, .1, .06, .06];
    c.aging = mix.map(f => total * f);
    c.payerAging = PAYERS.map(() => c.aging.map(v => v / PAYERS.length * between(.5, 1.5)));
    c.clean = 1 - c.den * between(.7, .9) - .02;
    c.ncr = between(.945, .985) - (c.den > .1 ? .02 : 0);
    c.sync = c.id === 'willow' ? { ok: false, ago: '3 h' } : { ok: true, ago: Math.round(between(2, 18)) + ' min' };
    c.underpaid = c.base * between(.008, .022);
  });

  // Work-queue items
  const FIRST = ['Maria','James','Aisha','Robert','Linh','David','Grace','Omar','Elena','Marcus','Priya','Thomas','Hannah','Luis','Nora','Kevin','Sofia','Andre','Ruth','Felix'];
  const LAST  = ['Alvarez','Brooks','Chen','Delgado','Evans','Fitzgerald','Garcia','Hughes','Ibrahim','Jensen','Kowalski','Lopez','Moreno','Nakamura','Okafor','Patel','Quinn','Russo','Sato','Thompson'];
  const PROVIDERS = ['Dr. A. Okoye, MD', 'Dr. S. Lindqvist, DO', 'Dr. R. Mehta, MD', 'K. Alder, PA-C', 'Dr. J. Whitfield, MD', 'M. Torres, NP'];
  const ICD = ['M17.11', 'I10', 'E11.9', 'F41.1', 'L57.0', 'M54.50', 'R07.9', 'Z00.129', 'M75.101', 'I48.91'];
  const mkItem = (type, i) => {
    const c = pick(CLIENTS), p = pick(PAYERS), r = type === 'denials' ? pick(REASONS) : null;
    const amt = Math.round(between(180, type === 'under' ? 1400 : 6200));
    const daysLeft = type === 'denials' ? Math.round(between(2, 55)) : type === 'filing' ? Math.round(between(3, 40)) : null;
    const deniedAgo = type === 'denials' ? Math.max(4, p.appeal - daysLeft) : null;
    const dosAgo = type === 'filing' ? p.tf - daysLeft : type === 'denials' ? deniedAgo + Math.round(between(18, 40)) : Math.round(between(24, 70));
    const contracted = type === 'under' ? amt : null;
    const paid = type === 'under' ? Math.round(amt * between(.62, .9)) : null;
    const winByReason = { auth: .48, nec: .57, elig: .41, code: .74, info: .88 };
    return {
      type, client: c, payer: p, reason: r,
      patient: pick(FIRST) + ' ' + pick(LAST),
      dob: `${String(Math.ceil(between(0, 12))).padStart(2,'0')}/${String(Math.ceil(between(0, 28))).padStart(2,'0')}/${Math.round(between(1945, 2018))}`,
      claim: 'CLM-' + (480000 + Math.round(rnd() * 99999)),
      amt, daysLeft, contracted, paid,
      win: r ? Math.min(.95, winByReason[r.k] * between(.85, 1.15)) : null,
      status: type === 'filing' ? pick(['Rejected — not resubmitted', 'Never submitted', 'Held: missing auth #', 'Rejected — invalid NPI']) : null,
      cpt: pick(['99214','99215','27447','93306','97110','90837','11102','29881','93000','99204']),
      id: type + i, deniedAgo, dosAgo,
      memberId: pick(['W', 'XJ', 'H', 'ZG', 'M']) + Math.round(between(1e8, 9e8)),
      provider: pick(PROVIDERS), icd: pick(ICD),
      priorAppeals: rnd() < .25 ? 1 : 0,
      paidAgo: Math.round(between(2, 20)),
      pattern: Math.round(between(3, 14)),
    };
  };
  const CONTACTS = ['Dr. Ellen Park', 'Marisol Vega', 'Tom Haverford', 'Priscilla Moon', 'Gabe Ortiz', 'Dr. Naomi Burke', 'Ines Kowal'];
  CLIENTS.forEach((c, i) => {
    c.contact = CONTACTS[i]; c.contactRole = i % 2 ? 'Practice manager' : 'Owner / physician';
    c.fee = [6.0, 5.5, 7.0, 5.0, 7.5, 8.0, 6.5][i]; c.since = [2019, 2021, 2022, 2020, 2023, 2024, 2021][i];
    c.lastReport = ['Oct 2', 'Oct 1', 'Oct 3', 'Oct 1', 'Oct 6', 'Sep 4', 'Oct 2'][i];
  });
  const QUEUE = { denials: [], filing: [], under: [] };
  for (let i = 0; i < 46; i++) QUEUE.denials.push(mkItem('denials', i));
  for (let i = 0; i < 22; i++) QUEUE.filing.push(mkItem('filing', i));
  for (let i = 0; i < 31; i++) QUEUE.under.push(mkItem('under', i));


  /* ---------- Team + per-claim workflow state ---------- */
  const TEAM = [
    { name: 'Dana Reyes', role: 'Billing lead', initials: 'DR' },
    { name: 'Jordan Pike', role: 'Denials specialist', initials: 'JP' },
    { name: 'Ama Mensah', role: 'A/R follow-up', initials: 'AM' },
    { name: 'Luis Ortega', role: 'Payment posting', initials: 'LO' },
  ];
  Object.values(QUEUE).forEach(list => list.forEach((q, i) => {
    q.assignee = i % 5 === 0 ? null : TEAM[(i * 7) % TEAM.length].name;
    q.state = 'open';       // open | appeal-submitted | resubmitted | dispute-filed | signoff-requested
    q.activity = [];        // { t, who, what }
  }));

  // Workflow changes persist for this browser tab so the dashboard and the full queue agree.
  const KEY = 'll-workflow-v1', AUDIT_KEY = 'll-audit-v1';
  const ALL = () => [...QUEUE.denials, ...QUEUE.filing, ...QUEUE.under];
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || '{}');
    ALL().forEach(q => { if (saved[q.id]) Object.assign(q, saved[q.id]); });
  } catch (e) {}
  const persist = () => {
    try {
      const out = {};
      ALL().forEach(q => { if (q.state !== 'open' || q.activity.length || q.touched) out[q.id] = { state: q.state, assignee: q.assignee, activity: q.activity, touched: true }; });
      sessionStorage.setItem(KEY, JSON.stringify(out));
    } catch (e) {}
  };
  let audit = [
    { t: '08:02', who: 'Dana Reyes', what: 'Signed in (MFA: authenticator app)' },
    { t: '08:04', who: 'System', what: 'Nightly 835/ERA import completed — 1,284 remittances' },
    { t: '08:15', who: 'Jordan Pike', what: 'Exported Harbor Orthopedics month-end report' },
    { t: '08:31', who: 'System', what: 'SimplePractice sync failed for Willow BH — retrying' },
  ];
  try { const a = JSON.parse(sessionStorage.getItem(AUDIT_KEY) || 'null'); if (Array.isArray(a)) audit = a; } catch (e) {}
  const logAudit = (who, what) => {
    audit.push({ t: new Date().toTimeString().slice(0, 5), who, what });
    try { sessionStorage.setItem(AUDIT_KEY, JSON.stringify(audit)); } catch (e) {}
  };
  const findClaim = id => ALL().find(q => q.id === id);

  window.LEDGER = { MONTHS, YEARS, CLIENTS, PAYERS, REASONS, PROVIDERS, ICD, QUEUE, TEAM, audit, logAudit, persist, findClaim, ALL };
})();
