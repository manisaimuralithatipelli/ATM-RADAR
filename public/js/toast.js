import { el } from './dom.js';

const DISMISS_AFTER_MS = 6000;

function region() {
  let node = document.getElementById('toast-region');
  if (!node) {
    node = el('div', {
      id: 'toast-region',
      class: 'toast-region',
      role: 'status',
      'aria-live': 'polite',
    });
    document.body.append(node);
  }
  return node;
}

export function showToast(message, { kind = 'info' } = {}) {
  const toast = el('p', { class: `toast toast--${kind}`, text: message });
  region().append(toast);
  setTimeout(() => toast.remove(), DISMISS_AFTER_MS);
}
