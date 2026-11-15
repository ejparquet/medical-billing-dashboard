/* Claim side drawer and claim actions, shared by the sub-pages (work queue, client report).
   Opens a claim's full detail in a drawer, and every action on it (appeal, call, assign,
   resubmit, sign-off, dispute, bundle, export) as a form in the same drawer. */
window.CLAIMS = (() => {
  const { CLIENTS, TEAM, QUEUE, logAudit, persist, findClaim } = window.LEDGER;
  const { $, moneyFull, pct, esc, chip, dayStr, mask, toast, download } = window.UI;

  // ---------- Drawer shell ----------
  document.body.insertAdjacentHTML('beforeend', `
    <div class="scrim" id="drawerScrim"></div>
    <aside class="drawer floating" id="drawer" tabindex="-1" aria-labelledby="drawerTitle" role="dialog" aria-modal="true">
      <div class="flex items-center gap-3 px-5 py-4 border-b" style="border-color: var(--line)">
        <button class="btn btn-ghost btn-sm px-2" id="drawerBack" aria-label="Back to the claim" hidden><svg width="16" height="16"><use href="#i-back"/></svg></button>
        <h3 class="font-display text-[24px]" id="drawerTitle"></h3>
        <button class="btn btn-ghost btn-sm px-2 ml-auto" data-close-drawer aria-label="Close"><svg width="16" height="16"><use href="#i-close"/></svg></button>
      </div>
      <div class="p-5 overflow-y-auto flex-1" id="drawerBody"></div>
      <div class="drawer-foot" id="drawerFoot" hidden></div>
    </aside>`);

  let onChange = () => {}, backTo = null, lastFocus = null;
  const open = (title, html, opts = {}) => {
    if (!$('#drawer').classList.contains('on')) lastFocus = document.activeElement;
    $('#drawerTitle').textContent = title; $('#drawerBody').innerHTML = html; $('#drawerBody').scrollTop = 0;
    const f = $('#drawerFoot'); f.innerHTML = opts.foot || ''; f.hidden = !opts.foot;
    backTo = opts.back || null; $('#drawerBack').hidden = !backTo;
    $('#drawer').classList.toggle('wide', !!opts.wide); $('#drawer').classList.add('on'); $('#drawerScrim').classList.add('on');
    $('#drawer').focus({ preventScroll: true });
  };
  const close = () => { $('#drawer').classList.remove('on'); $('#drawerScrim').classList.remove('on'); lastFocus?.focus?.({ preventScroll: true }); };
  $('#drawerScrim').addEventListener('click', close);
  $('[data-close-drawer]').addEventListener('click', close);
  $('#drawerBack').addEventListener('click', () => backTo && claimDrawer(findClaim(backTo)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#drawer').classList.contains('on')) close(); });

  // ---------- Pieces ----------
  const now = () => new Date().toTimeString().slice(0, 5);
  const initials = n => n.split(' ').filter(w => !w.endsWith('.')).map(w => w[0]).join('').slice(0, 2);
  const deadlineChip = d => d <= 7 ? chip('crit', 'alert', `${d}d left`) : d <= 21 ? chip('serious', 'clock', `${d}d left`) : d <= 35 ? chip('warn', 'clock', `${d}d left`) : chip('neutral', 'clock', `${d}d left`);
  const STATE_LABEL = { 'appeal-submitted': ['send', 'Appeal sent'], resubmitted: ['refresh', 'Resubmitted'], 'dispute-filed': ['scale', 'Dispute filed'], 'signoff-requested': ['clock', 'Sign-off requested'] };
  const statePill = q => STATE_LABEL[q.state] ? `<span class="state-pill"><svg><use href="#i-${STATE_LABEL[q.state][0]}"/></svg>${STATE_LABEL[q.state][1]}</span>` : '';
  const record = (q, what) => { q.activity.push({ t: now(), who: 'Dana Reyes', what }); q.touched = true; persist(); };
  const sec = (title, body) => `<div class="d-sec"><h4>${title}</h4>${body}</div>`;
  const kv = pairs => `<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px] leading-[1.45]">${pairs.map(([k, v]) => `<dt class="faint">${k}</dt><dd class="text-right num font-medium min-w-0">${v}</dd>`).join('')}</dl>`;
  const timeline = steps => `<ol class="tl">${steps.map(st => `<li class="${st.state || ''}"><span class="tl-dot"></span><div><div class="text-[13px] font-medium">${st.label}</div><div class="text-[12px] faint num">${st.date}${st.note ? ', ' + st.note : ''}</div></div></li>`).join('')}</ol>`;
  const steps = list => `<ol class="check-list">${list.map((t, i) => `<li><span class="n">${i + 1}</span><span>${t}</span></li>`).join('')}</ol>`;
  const formWrap = (id, body) => `<form id="drawerForm" data-form="${id}">${body}</form>`;
  const footBtns = (primary, secondary) => `${secondary ? `<button class="btn btn-ghost" type="submit" form="drawerForm" name="intent" value="draft">${secondary}</button>` : ''}<button class="btn btn-primary ml-auto" type="submit" form="drawerForm" name="intent" value="submit">${primary}</button>`;
  const claimSummary = q => `<div class="stat-grid">
      <div class="stat"><span>Claim</span><b class="num" style="font-size:17px">${q.claim}</b></div>
      <div class="stat"><span>${q.client.short}</span><b style="font-size:17px">${q.payer.n}</b></div></div>`;
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const DENIAL_INFO = {
    auth: { why: 'Service required prior authorization and none was on file with the payer.', fix: ['Request retro-authorization, or pull proof the auth was obtained', 'Attach clinical notes for the date of service', 'Include a letter of medical necessity from the provider'] },
    nec:  { why: 'Payer considers the service not medically necessary for the diagnosis billed.', fix: ['Attach progress notes that support the diagnosis', 'Cite the payer’s coverage policy (LCD/NCD or medical policy)', 'Document prior conservative treatment'] },
    elig: { why: 'Coverage was inactive or terminated on the date of service.', fix: ['Re-run eligibility (270/271) for the date of service', 'If other coverage is found, bill the correct payer', 'Otherwise move balance to patient with a coverage update form'] },
    code: { why: 'Procedure was bundled into another service paid on the same date.', fix: ['Check the NCCI edit for this CPT pair', 'Add modifier 59/XS if the service was distinct', 'Attach the procedure note showing a separate site or session'] },
    info: { why: 'Claim was missing information needed to adjudicate it. Usually fixable without an appeal.', fix: ['Add the missing referring NPI, modifier or units', 'Send a corrected claim (frequency code 7)', 'No appeal letter needed'] },
  };
  const FILING_INFO = {
    'Rejected — not resubmitted': { why: 'Payer front-end rejection (277CA): subscriber ID not found. A correction was never resubmitted.', fix: ['Verify member ID against the card or a 270 eligibility check', 'Correct the subscriber ID on the claim', 'Resubmit electronically today and keep the acceptance report'] },
    'Never submitted': { why: 'Charge exists in the PM system, but no claim was created: the encounter note is unsigned.', fix: ['Ask the provider to sign the encounter note', 'Generate the claim from the signed encounter', 'Submit in today’s batch'] },
    'Held: missing auth #': { why: 'Held by the claim scrubber: this CPT requires an authorization number for this payer.', fix: ['Pull the auth number from the payer portal', 'Add it to the claim (Box 23 / REF*G1)', 'Release the hold and submit'] },
    'Rejected — invalid NPI': { why: 'Clearinghouse rejection: rendering NPI is not enrolled with this payer.', fix: ['Confirm the provider’s enrollment status with the payer', 'Bill under the enrolled group NPI if the contract allows', 'Resubmit and keep proof of timely filing'] },
  };
  const ATTACH = {
    auth: ['Clinical notes for the date of service', 'Record of the authorization request', 'Letter of medical necessity'],
    nec: ['Progress notes supporting the diagnosis', 'Payer coverage policy citation', 'Prior treatment history'],
    elig: ['271 eligibility response for the date of service', 'Copy of the insurance card'],
    code: ['Procedure note showing a separate site or session', 'NCCI edit review'],
    info: ['Corrected claim (frequency code 7)'],
  };
  const ARGUMENT = {
    auth: 'Authorization was requested before the date of service. The enclosed records show the service was medically required and could not be delayed, and we ask that the authorization be applied to this date.',
    nec: 'The enclosed progress notes document the diagnosis and the conservative treatment that failed before this service, which meets the criteria in your published coverage policy.',
    elig: 'Our eligibility response shows the patient’s coverage was active on the date of service. A copy is enclosed.',
    code: 'This service was separate from the other procedure billed that day: it was performed at a different site and session, as the enclosed procedure note shows. Modifier 59 has been added.',
    info: 'The missing information has been added. A corrected claim is enclosed.',
  };

  // ---------- Claim detail drawer ----------
  const actionBtn = (q, act, label, primary) => `<button class="btn ${primary ? 'btn-primary' : 'btn-ghost'}" data-claim-act="${act}" data-id="${q.id}">${label}</button>`;
  const actionsFor = q => q.type === 'denials'
    ? [actionBtn(q, 'appeal', q.state === 'appeal-submitted' ? 'Send another appeal' : 'Draft appeal', true), actionBtn(q, 'call', 'Log payer call'), actionBtn(q, 'assign', q.assignee ? 'Reassign' : 'Assign')]
    : q.type === 'filing'
    ? [actionBtn(q, 'resubmit', 'Fix &amp; resubmit', true), actionBtn(q, 'signoff', 'Request sign-off'), actionBtn(q, 'assign', q.assignee ? 'Reassign' : 'Assign')]
    : [actionBtn(q, 'dispute', 'Dispute', true), actionBtn(q, 'bundle', `Bundle ${q.pattern + 1} claims`), actionBtn(q, 'export', `Export ${q.payer.n} list`), actionBtn(q, 'assign', q.assignee ? 'Reassign' : 'Assign')];

  const patientSec = q => sec('Patient and encounter', kv([
    ['Patient', `<span class="phi">${esc(mask(q.patient))}</span>`],
    ['Member ID', `<span class="phi">•••••${q.memberId.slice(-4)}</span>`],
    ['Rendering', q.provider], ['CPT', q.cpt], ['Practice', q.client.name],
  ]) + `<p class="text-[11.5px] faint mt-3 flex items-center gap-1.5"><svg width="12" height="12"><use href="#i-lock"/></svg>Patient details stay masked on this page. Appeals and disputes fill them in when they are sent.</p>`);

  const ownerSec = q => `<div class="d-sec flex flex-wrap items-center gap-2 text-[13px]"><span class="faint">Owner</span>${q.assignee ? `<span class="assignee"><i>${initials(q.assignee)}</i>${q.assignee}</span>` : '<span class="assignee faint">Unassigned</span>'}<span class="ml-auto">${statePill(q) || (q.type === 'under' ? '' : deadlineChip(q.daysLeft))}</span></div>`;
  const activitySec = q => q.activity.length ? sec('Activity on this claim', timeline(q.activity.slice().reverse().map(a => ({ state: 'done', label: esc(a.what), date: 'Today, ' + a.t, note: a.who })))) : '';

  function claimBody(q) {
    if (q.type === 'denials') {
      const info = DENIAL_INFO[q.reason.k], expected = q.amt * .56;
      return ownerSec(q) +
        `<div class="d-sec"><div class="stat-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr))"><div class="stat"><span>Billed</span><b class="num">${moneyFull(q.amt)}</b></div><div class="stat"><span>Win odds</span><b class="num">${pct(q.win, 0)}</b></div><div class="stat"><span>Expected</span><b class="num">${moneyFull(expected * q.win)}</b></div></div></div>` +
        sec('Why it was denied', `<p class="text-[13px] leading-[1.55]"><b>${q.reason.label} (${q.reason.code}).</b> ${info.why}</p>`) +
        sec('To overturn it', steps(info.fix)) +
        sec('Claim timeline', timeline([
          { state: 'done', label: 'Date of service', date: dayStr(-q.dosAgo) },
          { state: 'done', label: 'Submitted to ' + q.payer.n, date: dayStr(-q.dosAgo + 3), note: 'accepted by clearinghouse' },
          { state: 'bad', label: `Denied ${q.reason.code}`, date: dayStr(-q.deniedAgo), note: 'via 835 remittance' },
          ...(q.priorAppeals ? [{ state: 'bad', label: 'Level 1 appeal upheld', date: dayStr(-Math.round(q.deniedAgo / 2)) }] : []),
          { state: 'next', label: `${q.priorAppeals ? 'Level 2' : 'Level 1'} appeal deadline`, date: dayStr(q.daysLeft), note: `${q.payer.appeal}-day window` },
        ])) + activitySec(q) + patientSec(q);
    }
    if (q.type === 'filing') {
      const info = FILING_INFO[q.status];
      return ownerSec(q) +
        `<div class="d-sec"><div class="stat-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr))"><div class="stat"><span>Billed</span><b class="num">${moneyFull(q.amt)}</b></div><div class="stat"><span>Payer limit</span><b class="num">${q.payer.tf} days</b></div><div class="stat"><span>Limit date</span><b class="num" style="font-size:16px">${dayStr(q.daysLeft)}</b></div></div></div>` +
        sec(`What’s blocking it: ${q.status.toLowerCase()}`, `<p class="text-[13px] leading-[1.55]">${info.why}</p>`) +
        sec('To fix it', steps(info.fix)) +
        sec('Filing clock', timeline([
          { state: 'done', label: 'Date of service', date: dayStr(-q.dosAgo) },
          { state: 'bad', label: q.status, date: dayStr(-Math.max(1, q.dosAgo - 6)) },
          { state: 'next', label: `${q.payer.n} filing limit`, date: dayStr(q.daysLeft), note: 'almost nothing is recoverable after this' },
        ])) + activitySec(q) + patientSec(q);
    }
    const v = q.contracted - q.paid, same = Math.round(v * q.pattern * .9);
    return ownerSec(q) +
      `<div class="d-sec"><div class="stat-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr))"><div class="stat"><span>Contract rate</span><b class="num">${moneyFull(q.contracted)}</b></div><div class="stat"><span>Paid</span><b class="num">${moneyFull(q.paid)}</b></div><div class="stat"><span>Short by</span><b class="num" style="color: var(--crit-ink)">${moneyFull(v)}</b></div></div>
        <p class="text-[12.5px] muted mt-3">CPT ${q.cpt}, paid ${dayStr(-q.paidAgo)} with adjustment CO-45 (${pct(v / q.contracted, 0)} below contract).</p></div>` +
      sec('Pattern', `<p class="text-[13px] leading-[1.55]"><b>${q.payer.n}</b> also underpaid CPT ${q.cpt} on <b class="num">${q.pattern}</b> other claims this quarter, about <b class="num">${moneyFull(same)}</b> in total. That usually means the payer loaded an outdated fee schedule.</p>
        <div class="mt-3">${chip('warn', 'hourglass', 'Patient statement on hold')}</div><p class="text-[12px] faint mt-2">Held so the patient isn’t billed from the wrong amount.</p>`) +
      activitySec(q) + patientSec(q);
  }

  function claimDrawer(q) {
    open(`Claim ${q.claim}`, claimBody(q), { wide: true, foot: actionsFor(q).join('') });
  }

  // ---------- Action drawers ----------
  const back = q => ({ back: q.id });
  function appealDrawer(q) {
    const lvl = q.priorAppeals ? 2 : 1;
    const letter = `${dayStr(0)}

${q.payer.n}, Provider Appeals
Re: Level ${lvl} appeal for claim ${q.claim}

Patient: {{patient name}}    Member ID: {{member ID}}
Date of service: ${dayStr(-q.dosAgo)}    CPT ${q.cpt}    Billed ${moneyFull(q.amt)}
Denial: ${q.reason.code}, ${q.reason.label.toLowerCase()}

To the appeals reviewer,

On behalf of ${q.client.name} and ${q.provider}, we ask you to reconsider the denial above. ${ARGUMENT[q.reason.k]}

The documents listed below are enclosed. Please reprocess this claim for payment.

Sincerely,
Dana Reyes, Billing lead
Ledgerline, for ${q.client.name}`;
    open('Draft appeal', formWrap('appeal', `<input type="hidden" name="id" value="${q.id}">
      <div class="d-sec">${claimSummary(q)}<p class="text-[12.5px] muted mt-3 flex flex-wrap items-center gap-2">${deadlineChip(q.daysLeft)}<span>Level ${lvl} deadline ${dayStr(q.daysLeft)} (${q.payer.appeal}-day window)</span></p></div>
      <div class="d-sec"><h4>Letter</h4><textarea class="textarea" name="letter" aria-label="Appeal letter">${esc(letter)}</textarea>
        <p class="text-[12px] faint mt-2 flex items-center gap-1.5"><svg width="12" height="12"><use href="#i-lock"/></svg>Patient name and member ID are filled in when the appeal is sent, so they never show on screen.</p></div>
      <div class="d-sec"><h4>Attachments</h4><div class="flex flex-col gap-2">${ATTACH[q.reason.k].map(a => `<label class="check-row"><input type="checkbox" name="attach" value="${esc(a)}" checked>${a}</label>`).join('')}</div></div>
      <div class="d-sec"><h4>Send by</h4><div class="opt-grid">${['Payer portal', 'Fax', 'Mail'].map((m, i) => `<label class="opt"><input type="radio" name="method" value="${m}" ${i ? '' : 'checked'}>${m}</label>`).join('')}</div></div>`),
      { wide: true, foot: footBtns('Send appeal', 'Save draft'), ...back(q) });
  }
  function callDrawer(q) {
    open('Log payer call', formWrap('call', `<input type="hidden" name="id" value="${q.id}">
      <div class="d-sec">${claimSummary(q)}</div>
      <div class="d-sec grid gap-3">
        <label class="field">Who you spoke with<input class="input" name="rep" placeholder="Representative’s name" autocomplete="off"></label>
        <label class="field">Call reference number<input class="input" name="ref" placeholder="Given by the payer at the end of the call" autocomplete="off"></label>
        <label class="field">Outcome<select class="select-in" name="outcome">${['Payer will reprocess the claim', 'Payer needs more documentation', 'Denial upheld, appeal required', 'No answer, will call back'].map(o => `<option>${o}</option>`).join('')}</select></label>
        <label class="field">Follow up on<input class="input" type="date" name="follow" value="2026-10-26"></label>
        <label class="field">Notes<textarea class="textarea" style="min-height:110px" name="notes" placeholder="What the rep said, and anything they promised"></textarea></label>
      </div>`), { foot: footBtns('Save call'), ...back(q) });
  }
  function assignDrawer(q) {
    const load = n => window.LEDGER.ALL().filter(x => x.assignee === n && x.state === 'open').length;
    open('Assign claim', formWrap('assign', `<input type="hidden" name="id" value="${q.id}"><div class="d-sec">${claimSummary(q)}</div>
      <div class="d-sec"><h4>Owner</h4><div class="flex flex-col gap-2">${TEAM.map(t => `<label class="opt"><input type="radio" name="who" value="${t.name}" ${q.assignee === t.name ? 'checked' : ''}><span class="avatar" style="width:28px;height:28px;font-size:10.5px">${t.initials}</span><span class="leading-tight"><b class="block text-[13px] font-semibold">${t.name}</b><span class="text-[12px] faint">${t.role}, ${load(t.name)} open claims</span></span></label>`).join('')}
        <label class="opt"><input type="radio" name="who" value="" ${q.assignee ? '' : 'checked'}>Leave unassigned</label></div></div>`), { foot: footBtns('Save owner'), ...back(q) });
  }
  function resubmitDrawer(q) {
    const fields = {
      'Rejected — not resubmitted': `<label class="field">Corrected member ID<input class="input" name="fix" required placeholder="As printed on the insurance card" autocomplete="off"></label><label class="field">Checked against<select class="select-in" name="source"><option>Insurance card</option><option>270/271 eligibility response</option></select></label>`,
      'Never submitted': `<label class="check-row"><input type="checkbox" name="fix" value="signed" required>The provider has signed the encounter note</label>`,
      'Held: missing auth #': `<label class="field">Authorization number<input class="input" name="fix" required placeholder="From the payer portal" autocomplete="off"></label>`,
      'Rejected — invalid NPI': `<label class="field">Bill under<select class="select-in" name="fix"><option>Group NPI (enrolled with this payer)</option><option>Rendering NPI, now that enrollment is approved</option></select></label>`,
    }[q.status];
    open('Fix and resubmit', formWrap('resubmit', `<input type="hidden" name="id" value="${q.id}">
      <div class="d-sec">${claimSummary(q)}<p class="text-[12.5px] muted mt-3 flex flex-wrap items-center gap-2">${deadlineChip(q.daysLeft)}<span>${q.payer.n} stops accepting it on ${dayStr(q.daysLeft)}</span></p></div>
      <div class="d-sec"><h4>${q.status}</h4><p class="text-[13px] muted mb-3">${FILING_INFO[q.status].why}</p><div class="grid gap-3">${fields}</div></div>
      <div class="d-sec"><label class="check-row"><input type="checkbox" name="proof" checked>Save the clearinghouse acceptance report as proof of timely filing</label></div>`), { foot: footBtns('Resubmit claim'), ...back(q) });
  }
  function signoffDrawer(q) {
    open('Request sign-off', formWrap('signoff', `<input type="hidden" name="id" value="${q.id}"><div class="d-sec">${claimSummary(q)}</div>
      <div class="d-sec grid gap-3"><label class="field">To<input class="input" value="${q.provider}, ${q.client.short}" readonly></label>
        <label class="field">Message<textarea class="textarea" style="min-height:140px" name="msg">The encounter note for claim ${q.claim} (date of service ${dayStr(-q.dosAgo)}) needs your signature before we can bill it. ${q.payer.n} stops accepting this claim on ${dayStr(q.daysLeft)}. Thank you.</textarea></label>
        <label class="field">Needed by<select class="select-in" name="by"><option>End of today</option><option>Tomorrow</option><option>Within 3 days</option></select></label></div>`), { foot: footBtns('Send request'), ...back(q) });
  }
  function disputeDrawer(q) {
    const v = q.contracted - q.paid;
    open('Dispute underpayment', formWrap('dispute', `<input type="hidden" name="id" value="${q.id}">
      <div class="d-sec"><div class="stat-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr))"><div class="stat"><span>Contract rate</span><b class="num">${moneyFull(q.contracted)}</b></div><div class="stat"><span>Paid</span><b class="num">${moneyFull(q.paid)}</b></div><div class="stat"><span>Short by</span><b class="num" style="color: var(--crit-ink)">${moneyFull(v)}</b></div></div>
        <p class="text-[12.5px] muted mt-3">${q.claim}, ${q.client.short}, CPT ${q.cpt}. Paid ${dayStr(-q.paidAgo)}. Contract source: ${q.payer.n} 2026 fee schedule.</p></div>
      <div class="d-sec grid gap-3"><label class="field">Reason<select class="select-in" name="reason"><option>Paid below the contracted fee schedule</option><option>Incorrect multiple-procedure reduction</option><option>Modifier reduction applied in error</option></select></label>
        <label class="check-row"><input type="checkbox" name="bundle" checked>Include the ${q.pattern} other ${q.payer.n} claims underpaid for CPT ${q.cpt} this quarter</label></div>
      <div class="d-sec"><h4>Send by</h4><div class="opt-grid">${['Portal reconsideration', 'Provider rep email', 'Written dispute'].map((m, i) => `<label class="opt"><input type="radio" name="method" value="${m}" ${i ? '' : 'checked'}>${m}</label>`).join('')}</div></div>`), { foot: footBtns('File dispute'), ...back(q) });
  }
  const patternClaims = q => [...Array(q.pattern)].map((_, k) => ({ claim: 'CLM-' + (Number(q.claim.slice(4)) - 913 * (k + 1)), paid: dayStr(-(q.paidAgo + 6 * (k + 1))), variance: Math.round((q.contracted - q.paid) * (.8 + ((k * 37) % 40) / 100)) }));
  function bundleDrawer(q) {
    const list = [{ claim: q.claim, paid: dayStr(-q.paidAgo), variance: q.contracted - q.paid }, ...patternClaims(q)];
    const tot = list.reduce((a, x) => a + x.variance, 0);
    open(`Bundle ${list.length} claims`, formWrap('bundle', `<input type="hidden" name="id" value="${q.id}">
      <div class="d-sec"><div class="stat-grid"><div class="stat"><span>Claims</span><b class="num">${list.length}</b></div><div class="stat"><span>Total short</span><b class="num" style="color: var(--crit-ink)">${moneyFull(tot)}</b></div></div>
        <p class="text-[12.5px] muted mt-3">${q.payer.n} underpaid CPT ${q.cpt} on each of these. One dispute is faster: payers usually reprocess the whole batch together.</p></div>
      <div class="d-sec"><table class="tbl"><thead><tr><th>Claim</th><th>Paid on</th><th class="r">Short by</th></tr></thead><tbody>${list.map(x => `<tr><td class="claim-id">${x.claim}</td><td class="num muted">${x.paid}</td><td class="r num">${moneyFull(x.variance)}</td></tr>`).join('')}</tbody></table></div>`),
      { wide: true, foot: footBtns('File bundled dispute'), ...back(q) });
  }
  function exportVariance(q) {
    const rows = QUEUE.under.filter(x => x.payer === q.payer);
    download(`underpayments-${slug(q.payer.n)}-2026-10-19.csv`, [['Claim', 'Practice', 'Payer', 'CPT', 'Contract rate', 'Paid', 'Short by', 'Paid on'], ...rows.map(x => [x.claim, x.client.name, x.payer.n, x.cpt, x.contracted, x.paid, x.contracted - x.paid, dayStr(-x.paidAgo)])]);
    logAudit('Dana Reyes', `Downloaded ${q.payer.n} underpayment list (${rows.length} claims, no patient details)`);
    toast(`Downloaded ${rows.length} ${q.payer.n} underpayments, without patient details`);
  }

  const ACTS = { appeal: appealDrawer, call: callDrawer, assign: assignDrawer, resubmit: resubmitDrawer, signoff: signoffDrawer, dispute: disputeDrawer, bundle: bundleDrawer, export: exportVariance, open: claimDrawer };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-claim-act]'); if (!b) return;
    e.preventDefault();
    const q = findClaim(b.dataset.id); if (q) ACTS[b.dataset.claimAct]?.(q);
  });

  // After an action, return to the claim so the person sees the new status and activity.
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f || !(f.dataset.form in ACTS)) return;
    e.preventDefault();
    const fd = new FormData(f), intent = e.submitter?.value || 'submit', q = findClaim(fd.get('id'));
    const done = msg => { onChange(); claimDrawer(q); toast(msg); };
    switch (f.dataset.form) {
      case 'appeal': {
        if (intent === 'draft') { record(q, 'Saved an appeal letter draft'); return done('Draft saved to the claim'); }
        const n = fd.getAll('attach').length;
        q.state = 'appeal-submitted';
        record(q, `Sent level ${q.priorAppeals ? 2 : 1} appeal by ${fd.get('method').toLowerCase()} with ${n} attachment${n === 1 ? '' : 's'}`);
        logAudit('Dana Reyes', `Sent appeal for ${q.claim} to ${q.payer.n} (patient details added at send)`);
        return done(`Appeal for ${q.claim} sent to ${q.payer.n}`);
      }
      case 'call':
        record(q, `Payer call: ${fd.get('outcome').toLowerCase()}${fd.get('ref') ? `, reference ${fd.get('ref')}` : ''}${fd.get('rep') ? `, spoke with ${fd.get('rep')}` : ''}`);
        return done(`Call logged to ${q.claim}`);
      case 'assign': {
        const who = fd.get('who') || null; q.assignee = who; record(q, who ? `Assigned to ${who}` : 'Left unassigned');
        return done(who ? `${q.claim} assigned to ${who}` : `${q.claim} is unassigned`);
      }
      case 'resubmit':
        q.state = 'resubmitted'; record(q, `Corrected and resubmitted to ${q.payer.n}`);
        logAudit('Dana Reyes', `Resubmitted ${q.claim} to ${q.payer.n}`);
        return done(`${q.claim} resubmitted. The acceptance report is saved as proof of timely filing.`);
      case 'signoff':
        q.state = 'signoff-requested'; record(q, `Asked ${q.provider} to sign the note, needed ${fd.get('by').toLowerCase()}`);
        return done(`Sign-off request sent to ${q.provider}`);
      case 'dispute':
        q.state = 'dispute-filed'; record(q, `Filed dispute by ${fd.get('method').toLowerCase()}${fd.get('bundle') ? `, with ${q.pattern} similar claims` : ''}`);
        logAudit('Dana Reyes', `Filed underpayment dispute for ${q.claim} with ${q.payer.n}`);
        return done(`Dispute filed with ${q.payer.n}`);
      case 'bundle':
        q.state = 'dispute-filed'; record(q, `Filed one dispute covering ${q.pattern + 1} claims`);
        logAudit('Dana Reyes', `Filed bundled dispute (${q.pattern + 1} claims) with ${q.payer.n}`);
        return done(`Dispute for ${q.pattern + 1} claims filed with ${q.payer.n}`);
    }
  });

  return { open, close, claimDrawer, deadlineChip, statePill, onChange: fn => { onChange = fn; } };
})();
