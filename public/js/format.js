// Locale-aware formatting. Values come from the API in a neutral form
// (ISO dates, metres) and are formatted here for the chosen language.

import { getLocaleTag } from './i18n.js';

export function formatDistance(meters) {
  const locale = getLocaleTag();
  if (meters < 1000) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'meter',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
    }).format(Math.round(meters / 10) * 10 || meters);
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(meters / 1000);
}

export function formatDateTime(iso) {
  return new Intl.DateTimeFormat(getLocaleTag(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  );
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat(getLocaleTag(), { timeStyle: 'short' }).format(new Date(iso));
}

export function formatRelativeTime(iso, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat(getLocaleTag(), { numeric: 'auto' });
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffSeconds / 86400), 'day');
}

export function formatNumber(value) {
  return new Intl.NumberFormat(getLocaleTag()).format(value);
}

export function formatDate(iso) {
  return new Intl.DateTimeFormat(getLocaleTag(), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
}
