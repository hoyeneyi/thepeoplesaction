// Public calendar: upcoming lists ([data-events]) and the full calendar ([data-calendar]).
import { watchEvents } from './data.js';
import { CATEGORIES, categoryLabel } from './categories.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^(https:\/\/|\/)/.test(u || '') ? u : '');

const fmt = {
  month: new Intl.DateTimeFormat('en-US', { month: 'short' }),
  day: new Intl.DateTimeFormat('en-US', { day: 'numeric' }),
  wday: new Intl.DateTimeFormat('en-US', { weekday: 'short' }),
  long: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }),
  tz: new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }),
  monthYear: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }),
};
const tzAbbr = (d) => fmt.tz.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || '';
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function timeRange(e) {
  if (e.allDay) return 'All day';
  const s = fmt.time.format(e.start);
  if (!e.end) return `${s} ${tzAbbr(e.start)}`;
  return sameDay(e.start, e.end) ? `${s} – ${fmt.time.format(e.end)} ${tzAbbr(e.start)}` : `${s} – ${fmt.long.format(e.end)} ${fmt.time.format(e.end)}`;
}

const icon = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6"/></svg>',
};

const upcoming = (events, now = new Date()) =>
  events.filter((e) => (e.end || e.start) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())).sort((a, b) => a.start - b.start);

function itemHTML(e) {
  return `<li class="event-item">
    <div class="date-sign" aria-hidden="true"><span class="m">${fmt.month.format(e.start)}</span><span class="d">${fmt.day.format(e.start)}</span><span class="w">${fmt.wday.format(e.start)}</span></div>
    <div>
      <div class="event-cat"><span class="tag tag--outline">${esc(categoryLabel(e.category))}${e.chapter === 'houston' ? ' · Houston' : ''}</span></div>
      <h3>${esc(e.title)}</h3>
      <p class="visually-hidden">${fmt.long.format(e.start)}</p>
      <div class="event-meta"><span>${icon.clock}${esc(timeRange(e))}</span>${e.location ? `<span>${icon.pin}${esc(e.location)}</span>` : ''}</div>
    </div>
    <div class="event-actions"><button class="btn btn--sm btn--ghost" type="button" data-open-event="${esc(e.id || e.title)}">Details<span class="visually-hidden"> for ${esc(e.title)}</span></button></div>
  </li>`;
}

function emptyHTML(context) {
  return `<div class="empty-state">
    <span class="tag">Check back soon</span>
    <h3>No events scheduled${context ? ' ' + esc(context) : ''} right now</h3>
    <p>New Adopt The Block days, community meetings and workshops are posted here as soon as they are scheduled.</p>
    <a class="btn btn--sm" href="/contact-us/?topic=volunteer#contact-form">Join the volunteer list</a>
  </div>`;
}

// ---------- Event details dialog + calendar export ----------
const pad = (n) => String(n).padStart(2, '0');
const icsDate = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const icsDay = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const endOf = (e) => e.end || new Date(e.start.getTime() + 2 * 3600e3);

function googleLink(e) {
  const dates = e.allDay
    ? `${icsDay(e.start)}/${icsDay(new Date((e.end || e.start).getTime() + 864e5))}`
    : `${icsDate(e.start)}/${icsDate(endOf(e))}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details: e.description, location: [e.location, e.address].filter(Boolean).join(', ') });
  return `https://calendar.google.com/calendar/render?${p}`;
}
function icsBlob(e) {
  const escI = (s) => String(s).replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Peoples Action//Events//EN', 'BEGIN:VEVENT',
    `UID:${(e.id || e.title).replace(/\W/g, '')}@thepeoplesaction.org`, `DTSTAMP:${icsDate(new Date())}`,
    e.allDay ? `DTSTART;VALUE=DATE:${icsDay(e.start)}` : `DTSTART:${icsDate(e.start)}`,
    e.allDay ? `DTEND;VALUE=DATE:${icsDay(new Date((e.end || e.start).getTime() + 864e5))}` : `DTEND:${icsDate(endOf(e))}`,
    `SUMMARY:${escI(e.title)}`, `DESCRIPTION:${escI(e.description)}`, `LOCATION:${escI([e.location, e.address].filter(Boolean).join(', '))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
}

let lastTrigger = null;
function openDialog(e) {
  const dlg = $('#event-dialog');
  if (!dlg) return;
  const mapQ = encodeURIComponent([e.location, e.address].filter(Boolean).join(', '));
  dlg.innerHTML = `
    <header><div><span class="tag" style="margin-bottom:.8rem">${esc(categoryLabel(e.category))}</span><h2 id="ev-dialog-title">${esc(e.title)}</h2></div>
      <button class="close" type="button" data-close aria-label="Close">${icon.close}</button></header>
    <div class="body">
      <dl>
        <dt>Date</dt><dd>${fmt.long.format(e.start)}</dd>
        <dt>Time</dt><dd>${esc(timeRange(e))}</dd>
        ${e.location ? `<dt>Where</dt><dd>${esc(e.location)}${e.address ? `<br><a href="https://www.google.com/maps/search/?api=1&query=${mapQ}" target="_blank" rel="noopener">${esc(e.address)} <span class="visually-hidden">(map, opens in new tab)</span></a>` : ''}</dd>` : ''}
      </dl>
      ${e.description ? `<div class="prose">${esc(e.description).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
      <div class="btn-row" style="margin-top:1.5rem">
        ${safeUrl(e.link) ? `<a class="btn btn--gold btn--sm" href="${esc(safeUrl(e.link))}" target="_blank" rel="noopener">${esc(e.linkLabel || 'Register')}</a>` : ''}
        <a class="btn btn--sm btn--ghost" href="${googleLink(e)}" target="_blank" rel="noopener">Add to Google Calendar</a>
        <a class="btn btn--sm btn--ghost" href="${icsBlob(e)}" download="${esc(e.title.replace(/[^\w ]+/g, '').trim() || 'event')}.ics">Download .ics</a>
      </div>
    </div>`;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); }, { once: true });
  dlg.addEventListener('close', () => lastTrigger?.focus(), { once: true });
  dlg.showModal();
}

let current = [];
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-open-event]');
  if (!b) return;
  const e = current.find((x) => (x.id || x.title) === b.dataset.openEvent);
  if (e) { lastTrigger = b; openDialog(e); }
});

// ---------- Upcoming lists ----------
function renderLists(events) {
  for (const host of document.querySelectorAll('[data-events]')) {
    const cat = host.dataset.category;
    const chapter = host.dataset.chapter;
    let list = upcoming(events);
    if (cat) list = list.filter((e) => cat.split(',').includes(e.category));
    if (chapter) list = list.filter((e) => e.chapter === chapter);
    list = list.slice(0, Number(host.dataset.limit || 50));
    host.innerHTML = list.length ? `<ul class="event-list">${list.map(itemHTML).join('')}</ul>` : emptyHTML(host.dataset.emptyContext || '');
  }
}

// ---------- Full calendar page ----------
const cal = { view: 'month', month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), filter: 'all' };

function renderCalendar(events) {
  const root = $('[data-calendar]');
  if (!root) return;
  const filtered = cal.filter === 'all' ? events : events.filter((e) => e.category === cal.filter || (cal.filter === 'houston' && e.chapter === 'houston'));
  $('[data-cal-title]', root).textContent = fmt.monthYear.format(cal.month);

  // Month grid (desktop/tablet)
  const grid = $('[data-cal-grid]', root);
  const first = new Date(cal.month);
  const startDay = new Date(first); startDay.setDate(1 - first.getDay());
  const today = new Date();
  let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDay); d.setDate(startDay.getDate() + i);
    if (i === 35 && d.getMonth() !== cal.month.getMonth()) break;
    const evs = filtered.filter((e) => sameDay(e.start, d)).sort((a, b) => a.start - b.start);
    cells += `<div class="cal-day${d.getMonth() !== cal.month.getMonth() ? ' is-out' : ''}${sameDay(d, today) ? ' is-today' : ''}">
      <span class="cal-num">${d.getDate()}</span>
      ${evs.map((e) => `<button class="cal-ev" type="button" tabindex="-1" data-open-event="${esc(e.id || e.title)}">${e.allDay ? '' : fmt.time.format(e.start).replace(':00', '') + ' '}${esc(e.title)}</button>`).join('')}
    </div>`;
  }
  grid.innerHTML = cells;
  grid.hidden = cal.view !== 'month';

  // Agenda (always used on mobile; optional on desktop)
  const agenda = $('[data-cal-agenda]', root);
  const monthEvents = filtered.filter((e) => e.start.getMonth() === cal.month.getMonth() && e.start.getFullYear() === cal.month.getFullYear()).sort((a, b) => a.start - b.start);
  const list = cal.view === 'list' ? upcoming(filtered) : monthEvents;
  agenda.innerHTML = list.length
    ? `<ul class="event-list">${list.map(itemHTML).join('')}</ul>`
    : emptyHTML(cal.view === 'list' ? '' : 'this month');
  $('[data-cal-nav]', root).hidden = cal.view === 'list';
  $('[data-cal-count]', root).textContent = `${list.length} event${list.length === 1 ? '' : 's'} ${cal.view === 'list' ? 'coming up' : 'this month'}`;
}

function initCalendarControls() {
  const root = $('[data-calendar]');
  if (!root) return;
  const filters = $('[data-cal-filters]', root);
  filters.innerHTML = [{ id: 'all', label: 'All events' }, ...CATEGORIES, { id: 'houston', label: 'Houston' }]
    .map((c) => `<button class="chip" type="button" data-filter="${c.id}" aria-pressed="${c.id === 'all'}">${esc(c.label)}</button>`).join('');
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    cal.filter = b.dataset.filter;
    filters.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderCalendar(current);
  });
  root.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-month]');
    if (nav) { cal.month = new Date(cal.month.getFullYear(), cal.month.getMonth() + Number(nav.dataset.month), 1); renderCalendar(current); }
    const v = e.target.closest('[data-view]');
    if (v) {
      cal.view = v.dataset.view;
      root.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === v)));
      renderCalendar(current);
    }
    const t = e.target.closest('[data-today]');
    if (t) { cal.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(current); }
  });
}

initCalendarControls();
watchEvents((events) => {
  current = events;
  renderLists(events);
  renderCalendar(events);
}).catch(() => {
  document.querySelectorAll('[data-events]').forEach((h) => { h.innerHTML = emptyHTML(''); });
});
