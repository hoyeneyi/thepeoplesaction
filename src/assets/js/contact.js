// Contact / volunteer form. Saves to the Firestore "messages" inbox (read in the admin
// portal). If Firebase isn't configured or the save fails, it falls back to opening the
// visitor's email app with the message pre-filled, so no message is silently lost.
import { submitMessage, isLive } from './data.js';
import { CONTACT_EMAIL } from './config.js';

const form = document.querySelector('[data-contact-form]');

function preselectTopic() {
  const topic = new URLSearchParams(location.search).get('topic');
  const sel = form?.querySelector('#cf-topic');
  if (sel && topic && [...sel.options].some((o) => o.value === topic)) sel.value = topic;
}

// Links like "?topic=army#contact-form" on the same page: set the topic without reload.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-topic]');
  if (!a || !form) return;
  e.preventDefault();
  form.querySelector('#cf-topic').value = a.dataset.topic;
  history.replaceState(null, '', `?topic=${a.dataset.topic}#contact-form`);
  document.getElementById('contact-form').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  form.querySelector('#cf-name').focus({ preventScroll: true });
});

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function validate() {
  const checks = [
    ['cf-name', (v) => v.trim().length > 0],
    ['cf-email', (v) => emailOk(v.trim())],
    ['cf-message', (v) => v.trim().length > 0],
  ];
  let first = null;
  for (const [id, ok] of checks) {
    const el = form.querySelector('#' + id);
    const valid = ok(el.value);
    el.setAttribute('aria-invalid', String(!valid));
    form.querySelector(`#${id}-err`).hidden = valid;
    if (!valid && !first) first = el;
  }
  first?.focus();
  return !first;
}

function status(kind, html) {
  const s = form.querySelector('[data-form-status]');
  s.className = `form-status ${kind === 'ok' ? 'is-ok' : kind === 'err' ? 'is-err' : ''}`;
  s.innerHTML = html;
  s.hidden = false;
}

function mailtoFallback(d) {
  const topic = form.querySelector('#cf-topic').selectedOptions[0].textContent;
  const body = `${d.message}\n\n— ${d.name}\n${d.email}${d.phone ? '\n' + d.phone : ''}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Website message: ' + topic)}&body=${encodeURIComponent(body)}`;
}

if (form) {
  preselectTopic();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.querySelector('#cf-website').value) return; // honeypot: silently ignore bots
    if (!validate()) return;
    const d = {
      name: form.querySelector('#cf-name').value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      topic: form.topic.value,
      message: form.message.value.trim(),
      page: location.pathname,
    };
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      if (!isLive()) throw new Error('offline');
      await submitMessage(d);
      form.reset();
      status('ok', '<strong>Thank you — your message was sent.</strong> Someone from TPA will get back to you.');
    } catch {
      const href = mailtoFallback(d);
      status('err', `<strong>We couldn’t send this through the website.</strong> <a href="${href}">Open it in your email app</a> to send it to ${CONTACT_EMAIL} instead — your message is already filled in.`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send message';
    }
  });
}
