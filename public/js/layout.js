// Shared header used by every page. Language and theme controls mount into
// the controls area when those features are added.

import { el } from './dom.js';
import { icon } from './icons.js';
import {
  applyTranslations,
  getLanguage,
  setLanguage,
  onLanguageChange,
  LANGUAGE_NAMES,
  t,
} from './i18n.js';
import { showToast } from './toast.js';
import { getTheme, toggleTheme, onThemeChange } from './theme.js';
import {
  DEVELOPER_NAME,
  DEVELOPER_TAGLINE,
  DEVELOPER_PHOTO,
  DEVELOPER_EMAIL,
  DEVELOPER_GITHUB,
  DEVELOPER_LINKEDIN,
} from './site-config.js';

function buildLanguageSwitch() {
  const select = el('select', {
    id: 'language-select',
    class: 'input input--compact',
    'data-i18n-aria-label': 'nav.language',
    'data-i18n-title': 'nav.language',
  });

  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    select.append(el('option', { value: code, lang: code, text: name }));
  }
  select.value = getLanguage();

  select.addEventListener('change', async () => {
    try {
      await setLanguage(select.value);
    } catch (err) {
      // The new language file could not be loaded, so stay on the current one
      select.value = getLanguage();
      showToast(t('errors.NETWORK_ERROR'), { kind: 'error' });
    }
  });

  onLanguageChange(() => {
    select.value = getLanguage();
  });

  return el('div', { class: 'lang-switch' }, icon('globe', 18), select);
}

function buildThemeToggle() {
  const button = el(
    'button',
    { type: 'button', class: 'btn btn--secondary btn--small theme-toggle', id: 'theme-toggle' },
    icon('moon', 16),
    el('span', { 'data-i18n': 'nav.darkMode' })
  );

  const sync = () => button.setAttribute('aria-pressed', getTheme() === 'dark' ? 'true' : 'false');
  sync();

  button.addEventListener('click', toggleTheme);
  onThemeChange(sync);
  return button;
}

export function mountHeader({ active = 'home' } = {}) {
  const host = document.getElementById('site-header');
  if (!host) throw new Error('Missing #site-header element');

  const brand = el(
    'a',
    { class: 'brand', href: '/' },
    el('img', { class: 'brand__logo', src: '/images/logo-128.png', alt: '', width: '40', height: '40' }),
    el(
      'span',
      { class: 'brand__text' },
      el('span', { class: 'brand__name', 'data-i18n': 'brand.name' }),
      el('span', { class: 'brand__tagline', 'data-i18n': 'brand.tagline' })
    )
  );

  const navItems = [
    { id: 'home', href: '/', key: 'nav.home' },
    { id: 'why-this', href: '/why-this', key: 'nav.whyThis' },
  ];

  const nav = el(
    'nav',
    { class: 'site-nav', 'data-i18n-aria-label': 'nav.main' },
    el(
      'ul',
      { class: 'site-nav__list' },
      navItems.map((item) =>
        el(
          'li',
          {},
          el('a', {
            href: item.href,
            'data-i18n': item.key,
            'aria-current': item.id === active ? 'page' : null,
          })
        )
      )
    )
  );

  const controls = el('div', { class: 'header-controls' }, buildLanguageSwitch(), buildThemeToggle());
  const auth = el('div', { class: 'auth-controls' });

  const header = el(
    'header',
    { class: 'site-header' },
    el('div', { class: 'site-header__inner' }, brand, nav, controls, auth)
  );

  host.replaceWith(header);
  header.id = 'site-header';
  applyTranslations(header);

  return { header, nav, controlsEl: controls, authEl: auth };
}

// Returns only valid contact links, so a typo in site-config.js cannot create an unsafe link.
// Order: LinkedIn, GitHub, email.
export function contactLinks({ email, github, linkedin } = {}) {
  const links = [];

  const checked = (value, hosts) => {
    try {
      const url = new URL(value);
      const ok = url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password;
      return ok ? url : null;
    } catch (err) {
      return null;
    }
  };
  const shown = (url) => url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '');

  const li = checked(linkedin, ['www.linkedin.com', 'linkedin.com']);
  if (li) links.push({ key: 'footer.linkedin', icon: 'linkedin', href: li.href, text: shown(li), external: true });

  const gh = checked(github, ['github.com']);
  if (gh) links.push({ key: 'footer.github', icon: 'github', href: gh.href, text: shown(gh), external: true });

  if (typeof email === 'string' && /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(email)) {
    links.push({ key: 'footer.email', icon: 'mail', href: `mailto:${email}`, text: email, external: false });
  }

  return links;
}

// First letter of the first and last word, for the photo fallback
export function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (words[0][0] + last).toUpperCase();
}

// Only a path to a local image file is accepted (the page's security policy blocks other sites)
export function isLocalImagePath(path) {
  return typeof path === 'string' && /^\/(?!\/)[\w./-]+\.(jpe?g|png|webp|avif)$/i.test(path) && !path.includes('..');
}

function developerAvatar() {
  const initials = () =>
    el('span', { class: 'dev-card__avatar dev-card__initials', 'aria-hidden': 'true', text: initialsOf(DEVELOPER_NAME) });

  if (!isLocalImagePath(DEVELOPER_PHOTO)) return initials();

  // Decorative: the name is written next to the photo, so the image has an empty alt text
  const image = el('img', {
    class: 'dev-card__avatar',
    src: DEVELOPER_PHOTO,
    alt: '',
    width: '80',
    height: '80',
    decoding: 'async',
  });
  image.addEventListener('error', () => image.replaceWith(initials()), { once: true });
  return image;
}

export function mountFooter() {
  const host = document.getElementById('site-footer');
  if (!host) throw new Error('Missing #site-footer element');

  const link = (href, key) => el('li', {}, el('a', { href, 'data-i18n': key }));

  const contact = contactLinks({
    email: DEVELOPER_EMAIL,
    github: DEVELOPER_GITHUB,
    linkedin: DEVELOPER_LINKEDIN,
  }).map((item) =>
    el(
      'li',
      {},
      el(
        'a',
        {
          class: 'dev-link',
          href: item.href,
          title: item.text,
          ...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
        icon(item.icon, 18),
        el('span', { 'data-i18n': item.key }),
        item.external && ' ',
        item.external && el('span', { class: 'visually-hidden', 'data-i18n': 'detail.directionsNewTab' })
      )
    )
  );

  const copyright = el('p', { class: 'site-footer__copyright' });
  const renderCopyright = () => {
    copyright.textContent = t('footer.copyright', { year: new Date().getFullYear(), name: t('brand.name') });
  };
  renderCopyright();
  onLanguageChange(renderCopyright);

  const footer = el(
    'footer',
    { class: 'site-footer' },
    el(
      'div',
      { class: 'site-footer__inner' },
      el(
        'section',
        { class: 'site-footer__about', 'aria-labelledby': 'footer-brand' },
        el('h2', { class: 'site-footer__brand', id: 'footer-brand', 'data-i18n': 'brand.name' }),
        el('p', { class: 'site-footer__product', 'data-i18n': 'brand.product' }),
        el('p', { class: 'site-footer__text', 'data-i18n': 'footer.description' })
      ),
      el(
        'nav',
        { class: 'site-footer__nav', 'data-i18n-aria-label': 'footer.navLabel' },
        el('h2', { class: 'site-footer__heading', 'data-i18n': 'footer.linksHeading' }),
        el(
          'ul',
          { class: 'site-footer__links' },
          link('/', 'nav.home'),
          link('/why-this', 'nav.whyThis'),
          link('/privacy', 'footer.privacy'),
          link('/terms', 'footer.terms')
        )
      ),
      el(
        'section',
        { class: 'dev-card', 'aria-labelledby': 'footer-credit' },
        el('h2', { class: 'site-footer__heading', id: 'footer-credit', 'data-i18n': 'footer.developerHeading' }),
        el(
          'div',
          { class: 'dev-card__main' },
          developerAvatar(),
          el(
            'div',
            { class: 'dev-card__text' },
            el('p', { class: 'dev-card__name', text: DEVELOPER_NAME }),
            DEVELOPER_TAGLINE && el('p', { class: 'dev-card__tagline', text: DEVELOPER_TAGLINE })
          )
        ),
        contact.length > 0 && el('ul', { class: 'dev-card__links' }, contact),
        contact.length > 0 && el('ul', { class: 'dev-card__links' }, contact)
      )
    ),
    el(
      'div',
      { class: 'site-footer__legal' },
      el('p', { class: 'site-footer__disclaimer', 'data-i18n': 'footer.disclaimer' }),
      copyright
    )
  );

  host.replaceWith(footer);
  footer.id = 'site-footer';
  applyTranslations(footer);
  return footer;
}
