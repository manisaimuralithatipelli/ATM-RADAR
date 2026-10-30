import { initI18n, t, onLanguageChange, showErrorCode } from '../i18n.js';
import { initTheme } from '../theme.js';
import { mountHeader, mountFooter } from '../layout.js';
import { initAuth, getUser, requireLogin, onAuthChange, handleSessionExpired } from '../auth.js';
import { api } from '../api.js';
import { createMap, isMapAvailable } from '../map.js';
import { el, clear } from '../dom.js';
import { icon, statusIconName } from '../icons.js';
import { showToast } from '../toast.js';
import { validatePincode } from '../validators.js';
import { formatDistance, formatRelativeTime, formatDateTime } from '../format.js';

const RADIUS_OPTIONS = [2000, 5000, 10000, 20000];
const DEFAULT_RADIUS = 5000;

const state = {
  atms: [],
  status: 'loading', // loading | ready | error
  errorCode: null,
  validityMinutes: 60,
  selectedId: null,
  view: 'list', // list | detail
  origin: null, // { lat, lng, accuracy } kept in memory only, never stored
  radius: DEFAULT_RADIUS,
  locating: false,
  reporting: false,
  meta: null,
  details: {}, // atm id -> { recentReports } | { error: true }
};

const els = {};
let mapApi = null;
let searchController = null;
let searchSequence = 0;

const noopMap = {
  setAtms() {},
  select() {},
  clearSelection() {},
  setUserLocation() {},
  clearUserLocation() {},
  fit() {},
  refreshLabels() {},
  invalidateSize() {},
};

/* ---------- Boot ---------- */

async function boot() {
  await initI18n();
  initTheme();

  const header = mountHeader({ active: 'home' });
  mountFooter();
  initAuth(header.authEl);

  for (const id of [
    'search-form', 'q', 'pincode', 'pincode-error', 'bank', 'status', 'reset-btn',
    'near-me-btn', 'radius-row', 'radius', 'location-message', 'results-pane',
    'results-count', 'results-body', 'map', 'map-fallback',
  ]) {
    els[id] = document.getElementById(id);
  }

  setupMap();
  populateStatusFilter();
  populateBankFilter();
  populateRadius();
  updateNearUi();
  bindEvents();

  onLanguageChange(handleLanguageChange);
  onAuthChange(() => {
    if (state.view === 'detail') renderResults();
  });

  loadMeta();
  search({ fit: true });
}

function setupMap() {
  if (!isMapAvailable()) {
    els.map.hidden = true;
    els['map-fallback'].hidden = false;
    els['map-fallback'].textContent = t('map.loadError');
    mapApi = noopMap;
    return;
  }
  mapApi = createMap(els.map, { onSelect: (id) => selectAtm(id, { fromMap: true }) });
}

function bindEvents() {
  els['search-form'].addEventListener('submit', (event) => {
    event.preventDefault();
    search({ fit: true });
  });

  els.bank.addEventListener('change', () => search({ fit: true }));
  els.status.addEventListener('change', () => search({ fit: true }));

  els.pincode.addEventListener('input', () => {
    els.pincode.value = els.pincode.value.replace(/\D/g, '');
    setPincodeError(null);
  });

  els['reset-btn'].addEventListener('click', () => {
    els['search-form'].reset();
    setPincodeError(null);
    search({ fit: true });
  });

  els['near-me-btn'].addEventListener('click', toggleNearMe);

  els.radius.addEventListener('change', () => {
    state.radius = Number(els.radius.value) || DEFAULT_RADIUS;
    if (state.origin) search({ fit: true });
  });
}

function handleLanguageChange() {
  populateStatusFilter();
  populateBankFilter();
  populateRadius();
  updateNearUi();
  if (els['map-fallback'] && !els['map-fallback'].hidden) {
    els['map-fallback'].textContent = t('map.loadError');
  }
  renderResults();
  mapApi.setAtms(state.atms);
  mapApi.refreshLabels();
}

/* ---------- Filters ---------- */

function populateStatusFilter() {
  const current = els.status.value;
  clear(els.status);
  els.status.append(
    el('option', { value: '', text: t('search.anyStatus') }),
    ...['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN'].map((value) =>
      el('option', { value, text: t(`status.${value}`) })
    )
  );
  els.status.value = current;
}

function populateBankFilter() {
  const current = els.bank.value;
  clear(els.bank);
  els.bank.append(el('option', { value: '', text: t('search.anyBank') }));
  for (const bank of (state.meta && state.meta.banks) || []) {
    els.bank.append(el('option', { value: bank, text: bank }));
  }
  els.bank.value = current;
}

function populateRadius() {
  clear(els.radius);
  for (const value of RADIUS_OPTIONS) {
    els.radius.append(el('option', { value: String(value), text: formatDistance(value) }));
  }
  els.radius.value = String(state.radius);
}

async function loadMeta() {
  try {
    state.meta = await api.get('/api/atms/meta');
    populateBankFilter();
  } catch (err) {
    // Filters still work without the bank list
  }
}

function readFilters() {
  return {
    q: els.q.value.trim(),
    pincode: els.pincode.value.trim(),
    bank: els.bank.value,
    status: els.status.value,
  };
}

function setPincodeError(code) {
  const message = els['pincode-error'];
  if (code) {
    els.pincode.setAttribute('aria-invalid', 'true');
  } else {
    els.pincode.removeAttribute('aria-invalid');
  }
  showErrorCode(message, code);
}

/* ---------- Searching ---------- */

async function search({ fit = false } = {}) {
  const filters = readFilters();

  const pinError = validatePincode(filters.pincode);
  setPincodeError(pinError);
  if (pinError) {
    els.pincode.focus();
    return;
  }

  if (searchController) searchController.abort();
  searchController = new AbortController();
  const sequence = ++searchSequence;

  state.status = 'loading';
  els['results-pane'].setAttribute('aria-busy', 'true');
  renderResults();

  const query = { ...filters };
  if (state.origin) {
    query.lat = state.origin.lat;
    query.lng = state.origin.lng;
    query.radius = state.radius;
  }

  try {
    const data = await api.get('/api/atms', { query, signal: searchController.signal });
    if (sequence !== searchSequence) return;

    state.atms = data.atms;
    state.validityMinutes = data.validityMinutes;
    state.status = 'ready';

    if (state.selectedId && !state.atms.some((a) => a.id === state.selectedId)) {
      state.selectedId = null;
      state.view = 'list';
      mapApi.clearSelection();
    }

    els['results-pane'].removeAttribute('aria-busy');
    renderResults();
    mapApi.setAtms(state.atms, { fitBounds: fit });
    if (state.selectedId) mapApi.select(state.selectedId);
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    if (sequence !== searchSequence) return;
    state.status = 'error';
    state.errorCode = (err && err.code) || 'INTERNAL_ERROR';
    els['results-pane'].removeAttribute('aria-busy');
    renderResults();
  }
}

/* ---------- Browser location ("near me") ---------- */

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject({ code: 'GEO_UNSUPPORTED' });
    if (!window.isSecureContext) return reject({ code: 'GEO_INSECURE' });

    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      const codes = { 1: 'GEO_DENIED', 2: 'GEO_UNAVAILABLE', 3: 'GEO_TIMEOUT' };
      reject({ code: codes[error.code] || 'GEO_UNAVAILABLE' });
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  });
}

async function toggleNearMe() {
  if (state.locating) return;

  if (state.origin) {
    state.origin = null;
    mapApi.clearUserLocation();
    updateNearUi();
    search({ fit: true });
    return;
  }

  state.locating = true;
  updateNearUi();
  setLocationMessage(null);

  try {
    const position = await getPosition();
    state.origin = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
    mapApi.setUserLocation(state.origin.lat, state.origin.lng, state.origin.accuracy);
    state.locating = false;
    updateNearUi();
    await search({ fit: true });
  } catch (err) {
    state.locating = false;
    state.origin = null;
    updateNearUi();
    setLocationMessage({ code: (err && err.code) || 'GEO_UNAVAILABLE' });
  }
}

// message is null, { key } for an info text, or { code } for an error code.
// Keys and codes stay on the element so the text follows the selected language.
function setLocationMessage(message) {
  const node = els['location-message'];
  delete node.dataset.i18n;
  showErrorCode(node, null);

  if (message && message.code) {
    showErrorCode(node, message.code);
  } else if (message && message.key) {
    node.dataset.i18n = message.key;
    node.textContent = t(message.key);
  }

  const isError = Boolean(message && message.code);
  node.classList.toggle('form-error', isError);
  if (isError) node.setAttribute('role', 'alert');
  else node.removeAttribute('role');
}

function updateNearUi() {
  const button = els['near-me-btn'];
  clear(button);

  if (state.locating) {
    button.disabled = true;
    button.append(icon('locate', 18), t('search.locating'));
  } else {
    button.disabled = false;
    button.append(icon('locate', 18), t(state.origin ? 'search.nearMeStop' : 'search.nearMe'));
  }
  button.setAttribute('aria-pressed', state.origin ? 'true' : 'false');

  els['radius-row'].hidden = !state.origin;
  if (state.origin) setLocationMessage({ key: 'search.locationActive' });
  else if (!els['location-message'].classList.contains('form-error')) setLocationMessage(null);
}

/* ---------- Rendering ---------- */

function statusBadge(status, { large = false } = {}) {
  return el(
    'span',
    { class: `badge badge--${status.toLowerCase()}${large ? ' badge--large' : ''}` },
    icon(statusIconName(status), large ? 18 : 14),
    t(`status.${status}`)
  );
}

function availabilitySummary(availability) {
  if (availability.isValid) {
    return t('results.reportedAgo', {
      source: t(`source.${availability.source}`),
      time: formatRelativeTime(availability.reportedAt),
    });
  }
  return t('results.noRecentReport', { minutes: state.validityMinutes });
}

function renderResults() {
  const body = els['results-body'];
  clear(body);

  if (state.status === 'loading' && state.atms.length === 0) {
    els['results-count'].textContent = t('results.loading');
    body.append(el('p', { class: 'state-box', text: t('results.loading') }));
    return;
  }

  if (state.status === 'error') {
    els['results-count'].textContent = '';
    body.append(
      el(
        'div',
        { class: 'state-box', role: 'alert' },
        el('p', { class: 'state-box__title', text: t('results.error') }),
        el('p', { text: t(`errors.${state.errorCode || 'INTERNAL_ERROR'}`) }),
        el('button', {
          type: 'button',
          class: 'btn btn--secondary',
          text: t('results.retry'),
          on: { click: () => search({ fit: true }) },
        })
      )
    );
    return;
  }

  els['results-count'].textContent = t('results.count', { count: state.atms.length });

  const selected = state.atms.find((a) => a.id === state.selectedId);
  if (state.view === 'detail' && selected) {
    renderDetail(selected);
    return;
  }
  renderList();
}

function renderList() {
  const body = els['results-body'];

  if (state.atms.length === 0) {
    body.append(
      el(
        'div',
        { class: 'state-box' },
        el('p', { class: 'state-box__title', text: t(state.origin ? 'results.emptyNearby' : 'results.empty') }),
        el('p', { text: t(state.origin ? 'results.emptyNearbyHint' : 'results.emptyHint') })
      )
    );
    return;
  }

  body.append(el('ul', { class: 'atm-list' }, state.atms.map(atmCard)));
}

function atmCard(atm) {
  const availability = atm.availability;

  return el(
    'li',
    {
      class: `atm-card${atm.id === state.selectedId ? ' is-selected' : ''}`,
      on: { click: () => selectAtm(atm.id) },
    },
    el(
      'h3',
      { class: 'atm-card__name' },
      el('button', {
        type: 'button',
        class: 'atm-card__button',
        'data-atm-id': atm.id,
        text: atm.name,
      })
    ),
    el('p', { class: 'atm-card__meta', text: `${atm.bank}, ${atm.area}, ${atm.pincode}` }),
    el(
      'div',
      { class: 'atm-card__status' },
      statusBadge(availability.status),
      el('span', { class: 'atm-card__time' }, icon('clock', 14), availabilitySummary(availability))
    ),
    atm.distanceMeters !== undefined &&
      el('p', {
        class: 'atm-card__distance',
        text: t('results.distanceAway', { distance: formatDistance(atm.distanceMeters) }),
      })
  );
}

function row(label, value) {
  return el('div', { class: 'detail-row' }, el('dt', { text: label }), el('dd', {}, value));
}

function renderDetail(atm) {
  const a = atm.availability;
  const rows = [
    row(t('detail.status'), statusBadge(a.status, { large: true })),
    row(t('detail.bank'), atm.bank),
    row(t('detail.address'), atm.address),
    row(t('detail.pincode'), atm.pincode),
  ];

  if (a.isValid) {
    rows.push(
      row(t('detail.source'), t(`source.${a.source}`)),
      row(
        t('detail.reportedAt'),
        `${formatDateTime(a.reportedAt)} (${formatRelativeTime(a.reportedAt)})`
      ),
      row(t('detail.validUntil'), formatDateTime(a.expiresAt)),
      row(t('detail.validity'), t('detail.validNow')),
      row(t('reliability.label'), t(`reliability.${a.reliability}`))
    );
    if (a.source === 'community') {
      const parts = [el('span', { text: t('detail.matching', { count: a.supportingReports }) })];
      if (a.contradictingReports > 0) {
        parts.push(el('br'), el('span', { text: t('detail.conflicting', { count: a.contradictingReports }) }));
      }
      rows.push(row(t('detail.communityReports'), parts));
    }
  } else if (a.lastReport) {
    rows.push(
      row(
        t('detail.lastReport'),
        `${t(`status.${a.lastReport.status}`)}, ${t(`source.${a.lastReport.source}`)}, ${formatDateTime(a.lastReport.reportedAt)}`
      ),
      row(t('detail.validity'), t('detail.expired'))
    );
  } else {
    rows.push(row(t('detail.validity'), t('detail.noReports')));
  }

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${atm.lat},${atm.lng}`)}`;

  const panel = el(
    'article',
    { class: 'detail', 'aria-labelledby': 'detail-title' },
    el(
      'button',
      { type: 'button', class: 'btn btn--quiet btn--small', on: { click: closeDetail } },
      icon('back', 16),
      t('detail.back')
    ),
    el('h3', { class: 'detail__title', id: 'detail-title', tabindex: '-1', text: atm.name }),
    el('dl', { class: 'detail-list' }, rows),
    atm.isSimulated && el('p', { class: 'note', text: t('detail.simulatedNote') }),
    el(
      'a',
      {
        class: 'btn btn--secondary',
        href: directionsUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      t('detail.directions'),
      icon('external', 16),
      el('span', { class: 'visually-hidden', text: ` (${t('detail.directionsNewTab')})` })
    ),
    reportSection(atm),
    el(
      'section',
      { class: 'recent', 'aria-labelledby': 'recent-title' },
      el('h4', { class: 'section-title', id: 'recent-title', text: t('detail.recent') }),
      el('div', { id: 'recent-reports' })
    )
  );

  els['results-body'].append(panel);
  renderRecent(atm.id);
}

function reportSection(atm) {
  const buttons = [
    ['AVAILABLE', 'report.available'],
    ['UNAVAILABLE', 'report.unavailable'],
  ].map(([status, key]) =>
    el(
      'button',
      {
        type: 'button',
        class: `btn btn--report btn--${status.toLowerCase()}`,
        on: { click: () => submitReport(atm.id, status) },
      },
      icon(statusIconName(status), 18),
      t(key)
    )
  );

  return el(
    'section',
    { class: 'report', 'aria-labelledby': 'report-title' },
    el('h4', { class: 'section-title', id: 'report-title', text: t('report.title') }),
    el('p', { class: 'help', text: t('report.help') }),
    !getUser() && el('p', { class: 'help help--strong', text: t('report.loginHint') }),
    el('div', { class: 'report__buttons' }, buttons),
    el('p', { class: 'form-error', id: 'report-error', role: 'alert' })
  );
}

function renderRecent(atmId) {
  const host = document.getElementById('recent-reports');
  if (!host) return;
  clear(host);

  const detail = state.details[atmId];
  if (!detail) return;

  if (detail.error) {
    host.append(el('p', { class: 'help', text: t('detail.recentLoadError') }));
    return;
  }
  if (detail.recentReports.length === 0) {
    host.append(el('p', { class: 'help', text: t('detail.noReports') }));
    return;
  }

  host.append(
    el(
      'ul',
      { class: 'recent-list' },
      detail.recentReports.map((report) =>
        el(
          'li',
          { class: 'recent-list__item' },
          statusBadge(report.status),
          el('span', {
            class: 'recent-list__meta',
            text: `${t(`source.${report.source}`)}, ${formatDateTime(report.reportedAt)}`,
          })
        )
      )
    )
  );
}

async function loadDetail(atmId) {
  try {
    const data = await api.get(`/api/atms/${encodeURIComponent(atmId)}`);
    state.details[atmId] = { recentReports: data.recentReports };
  } catch (err) {
    state.details[atmId] = { error: true };
  }
  if (state.selectedId === atmId && state.view === 'detail') renderRecent(atmId);
}

/* ---------- Selecting and reporting ---------- */

// fromMap: the pin itself was pressed, so the map does not need to move or zoom
function selectAtm(id, { fromMap = false } = {}) {
  state.selectedId = id;
  state.view = 'detail';
  renderResults();
  mapApi.select(id, { zoomTo: !fromMap });
  loadDetail(id);

  const title = document.getElementById('detail-title');
  if (title) title.focus();
}

function closeDetail() {
  const previous = state.selectedId;
  state.view = 'list';
  renderResults();

  const button = previous && els['results-body'].querySelector(`button[data-atm-id="${previous}"]`);
  if (button) button.focus();
}

function showReportError({ code, text } = {}) {
  const node = document.getElementById('report-error');
  if (!node) return;
  if (code) showErrorCode(node, code);
  else {
    showErrorCode(node, null);
    node.textContent = text || '';
  }
}

function setReportBusy(busy) {
  for (const button of document.querySelectorAll('.btn--report')) button.disabled = busy;
}

async function submitReport(atmId, status) {
  if (state.reporting) return;

  const loggedIn = await requireLogin();
  if (!loggedIn) return;

  state.reporting = true;
  showReportError();
  setReportBusy(true);

  try {
    const data = await api.post(`/api/atms/${encodeURIComponent(atmId)}/reports`, { status });

    state.atms = state.atms.map((atm) =>
      atm.id === atmId ? { ...data.atm, distanceMeters: atm.distanceMeters } : atm
    );
    if (state.atms.every((atm) => atm.distanceMeters === undefined)) {
      state.atms = state.atms.map(({ distanceMeters, ...rest }) => rest);
    }

    delete state.details[atmId];
    renderResults();
    mapApi.setAtms(state.atms);
    mapApi.select(atmId);
    loadDetail(atmId);
    showToast(t('report.success'), { kind: 'success' });
  } catch (err) {
    if (err && err.status === 401) handleSessionExpired();

    if (err && err.code === 'REPORT_COOLDOWN') {
      const minutes = Math.max(1, Math.ceil((err.retryAfterSeconds || 60) / 60));
      showReportError({ text: t('report.cooldown', { count: minutes }) });
    } else {
      showReportError({ code: (err && err.code) || 'INTERNAL_ERROR' });
    }
  } finally {
    state.reporting = false;
    setReportBusy(false);
  }
}

boot();
