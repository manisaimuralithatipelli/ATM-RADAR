// Shared script for the content pages (Why This?, Privacy, Terms, Not found).

import { initI18n, t, onLanguageChange } from '../i18n.js';
import { initTheme } from '../theme.js';
import { mountHeader, mountFooter } from '../layout.js';
import { initAuth } from '../auth.js';
import { formatDate } from '../format.js';
import { LEGAL_LAST_UPDATED } from '../site-config.js';

async function boot() {
  await initI18n();
  initTheme();

  const active = document.body.dataset.page || null;
  const header = mountHeader({ active });
  mountFooter();
  initAuth(header.authEl);

  const updated = document.getElementById('last-updated');
  if (updated) {
    const render = () => {
      updated.textContent = t('common.lastUpdated', { date: formatDate(`${LEGAL_LAST_UPDATED}T12:00:00Z`) });
    };
    render();
    onLanguageChange(render);
  }
}

boot();
