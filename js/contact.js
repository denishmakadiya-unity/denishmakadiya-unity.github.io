/* Contact page */
const SOCIAL_NAME = { github: 'GitHub', linkedin: 'LinkedIn', youtube: 'YouTube', twitter: 'X / Twitter', instagram: 'Instagram', playstore: 'Google Play', assetstore: 'Unity Asset Store', itch: 'itch.io', discord: 'Discord' };
const SOCIAL_IC = { github: 'github', linkedin: 'linkedin', youtube: 'youtube', twitter: 'twitter', instagram: 'instagram', playstore: 'googleplay', assetstore: 'unity', itch: 'itch', discord: 'discord' };

async function init() {
  initNav();
  $$('[data-icon]').forEach(el => (el.outerHTML = ICONS[el.dataset.icon] || ''));
  let data;
  try { data = await loadData(); } catch (e) { $('#ctNote').textContent = e.message; return; }
  const { site, profile: p } = data;
  setBrand(site, p);
  setResumeLinks(p);
  document.title = `Contact — ${p.name}`;

  $('#status').classList.toggle('off', site.available === false);
  $('#statusText').textContent = site.available === false ? 'Currently busy — still happy to chat' : (site.statusText || 'Open to new opportunities');
  if (site.contactText) $('#ctIntro').textContent = site.contactText;
  if (site.replyTime) $('#replyTime').textContent = site.replyTime;
  $('#ctResume').hidden = !(p.resume && p.resume.path);

  // Live local time
  const tz = site.timezone || 'Asia/Kolkata';
  const city = (p.location || '').split(',')[0] || tz.split('/').pop().replace('_', ' ');
  const tick = () => {
    try {
      $('#localTime').textContent = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date());
      $('#tzLabel').textContent = `in ${city}`;
    } catch (_) { $('#localTime').textContent = ''; }
  };
  tick(); setInterval(tick, 30000);

  // Contact cards
  const cards = [];
  if (p.email) cards.push(`<div class="ct-item"><span class="ct-ic">${ICONS.mail}</span><div><small>Email</small><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>
    <button type="button" class="ct-copy" data-copy="${esc(p.email)}" title="Copy email">${ICONS.copy}</button></div>`);
  if (p.phone) cards.push(`<div class="ct-item"><span class="ct-ic">${ICONS.phone}</span><div><small>Phone / WhatsApp</small><a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${esc(p.phone)}</a></div></div>`);
  if ((p.socials || {}).linkedin) cards.push(`<div class="ct-item"><span class="ct-ic">${ICONS.linkedin}</span><div><small>LinkedIn</small><a href="${esc(p.socials.linkedin)}" target="_blank" rel="noopener">Connect on LinkedIn ↗</a></div></div>`);
  if (p.location) cards.push(`<div class="ct-item"><span class="ct-ic">${ICONS.pin}</span><div><small>Based in</small><span>${esc(p.location)}</span></div></div>`);
  $('#ctCards').innerHTML = cards.join('');
  $('#ctCards').addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.classList.add('done'); b.innerHTML = '✓'; setTimeout(() => { b.classList.remove('done'); b.innerHTML = ICONS.copy; }, 1800); } catch (_) {}
  });
  $('#ctSocials').innerHTML = Object.entries(p.socials || {}).filter(([, u]) => u)
    .map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="${SOCIAL_NAME[k]}" aria-label="${SOCIAL_NAME[k]}">${ICONS[SOCIAL_IC[k]]}</a>`).join('');

  // FAQ
  const faq = (site.faq || []).filter(f => f.q && f.a);
  $('#faqSec').hidden = !faq.length;
  $('#faqList').innerHTML = faq.map(f => `<details class="faq"><summary>${esc(f.q)}</summary><div>${miniMd(f.a)}</div></details>`).join('');

  // Topic → hide budget/timeline for job offers
  const form = $('#ctForm');
  const qs = new URLSearchParams(location.search);
  const about = qs.get('about');
  if (about) form.message.value = `Hi ${(p.name || "").split(" ")[0]}, I'd like to ask about "${about}".\n\n`;
  const pre = qs.get('topic');
  if (pre) { const r = $$('input[name=topic]', form).find(x => x.value.toLowerCase().startsWith(pre.toLowerCase())); if (r) r.checked = true; }
  const syncTopic = () => { $('#projectFields').hidden = form.topic.value === 'Full-time role'; };
  form.addEventListener('change', syncTopic); syncTopic();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const note = $('#ctNote'), btn = form.querySelector('button[type=submit]');
    const f = Object.fromEntries(new FormData(form));
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email) || !f.message.trim()) {
      note.className = 'form-note err'; note.textContent = 'Please fill your name, a valid email and a message.'; return;
    }
    if (f.topic === 'Full-time role') { delete f.budget; delete f.timeline; }
    btn.disabled = true; note.className = 'form-note'; note.textContent = 'Sending…';
    try {
      const r = await sendContact(f, site, p);
      if (r.sent) {
        form.innerHTML = `<div class="ct-done"><div class="ct-done-ic">✓</div><h2>Message sent!</h2><p>Thanks ${esc(f.name.split(' ')[0])} — I'll reply to <b>${esc(f.email)}</b> soon.</p><a class="btn" href="index.html#work">Explore my work</a></div>`;
        return;
      }
      note.className = 'form-note ok'; note.textContent = 'Your email app has opened — just press Send.';
    } catch (err) {
      note.className = 'form-note err';
      note.innerHTML = p.email ? `Couldn't send right now. Please email me directly at <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>.` : esc(err.message);
    }
    btn.disabled = false;
  });
}
init();
