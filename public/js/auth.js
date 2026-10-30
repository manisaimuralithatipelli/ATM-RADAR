// Login state, header buttons, and the login/signup dialog.
// The login token lives in an httpOnly cookie that scripts cannot read.

import { api } from './api.js';
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { t, applyTranslations, onLanguageChange, showErrorCode } from './i18n.js';
import { showToast } from './toast.js';
import {
  validateEmail,
  validateName,
  validateNewPassword,
  validateExistingPassword,
} from './validators.js';

let user = null;
let headerHost = null;
let dialog = null;
let mode = 'login';
let pendingResolve = null;
let submitting = false;
const listeners = new Set();

export function getUser() {
  return user;
}

// Called when the server answers 401 while the page still believed the user was logged in
export function handleSessionExpired() {
  if (user) setUser(null);
}

export function onAuthChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setUser(next) {
  user = next;
  renderHeader();
  for (const listener of listeners) listener(user);
}

export async function initAuth(authEl) {
  headerHost = authEl;
  buildDialog();
  renderHeader();
  onLanguageChange(() => {
    renderHeader();
    renderDialogText();
  });

  try {
    const data = await api.get('/api/auth/me');
    setUser(data.user || null);
  } catch (err) {
    console.warn('Could not check login state');
    setUser(null);
  }
}

function renderHeader() {
  if (!headerHost) return;
  clear(headerHost);

  if (user) {
    headerHost.append(
      el(
        'span',
        { class: 'auth-user' },
        icon('user', 16),
        el('span', { class: 'auth-user__name', text: user.name })
      ),
      el('button', {
        type: 'button',
        class: 'btn btn--secondary btn--small',
        'data-i18n': 'nav.logout',
        on: { click: logout },
      })
    );
  } else {
    headerHost.append(
      el('button', {
        type: 'button',
        class: 'btn btn--secondary btn--small',
        'data-i18n': 'nav.login',
        on: { click: () => openDialog('login') },
      }),
      el('button', {
        type: 'button',
        class: 'btn btn--primary btn--small',
        'data-i18n': 'nav.signup',
        on: { click: () => openDialog('signup') },
      })
    );
  }
  applyTranslations(headerHost);
}

async function logout() {
  try {
    await api.post('/api/auth/logout');
  } catch (err) {
    // Even if the request fails, show the logged out state only when it succeeded.
    showToast(t(`errors.${err.code || 'INTERNAL_ERROR'}`), { kind: 'error' });
    return;
  }
  setUser(null);
  showToast(t('auth.loggedOut'));
}

// Opens the dialog and resolves true after a successful login, false if closed.
export function requireLogin(startMode = 'login') {
  if (user) return Promise.resolve(true);
  return new Promise((resolve) => {
    if (pendingResolve) pendingResolve(false);
    pendingResolve = resolve;
    openDialog(startMode);
  });
}

function buildDialog() {
  const form = el(
    'form',
    { class: 'auth-form', id: 'auth-form', novalidate: true, on: { submit: onSubmit } },
    field('name', 'text', 'auth.name', 'name'),
    field('email', 'email', 'auth.email', 'email'),
    field('password', 'password', 'auth.password', 'current-password'),
    el('p', { class: 'field-hint', id: 'auth-password-hint', 'data-i18n': 'auth.passwordHint' }),
    el('p', { class: 'form-error', id: 'auth-form-error', role: 'alert' }),
    el('button', { type: 'submit', class: 'btn btn--primary btn--block', id: 'auth-submit' }),
    el('button', {
      type: 'button',
      class: 'btn btn--quiet btn--block',
      id: 'auth-switch',
      on: { click: () => setMode(mode === 'login' ? 'signup' : 'login') },
    })
  );

  dialog = el(
    'dialog',
    { class: 'dialog', id: 'auth-dialog', 'aria-labelledby': 'auth-title' },
    el(
      'div',
      { class: 'dialog__header' },
      el('h2', { id: 'auth-title', class: 'dialog__title' }),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--quiet btn--icon',
          'data-i18n-aria-label': 'auth.close',
          on: { click: () => dialog.close() },
        },
        icon('cross', 20)
      )
    ),
    form
  );

  dialog.addEventListener('close', () => {
    if (pendingResolve) {
      pendingResolve(false);
      pendingResolve = null;
    }
  });

  // Clicking the dimmed backdrop closes the dialog
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.body.append(dialog);
  applyTranslations(dialog);
}

function field(name, type, labelKey, autocomplete) {
  const id = `auth-${name}`;
  return el(
    'div',
    { class: 'field', id: `${id}-row` },
    el('label', { for: id, 'data-i18n': labelKey }),
    el('input', {
      id,
      name,
      type,
      autocomplete,
      class: 'input',
      required: true,
      maxlength: name === 'password' ? 128 : name === 'email' ? 254 : 60,
      'aria-describedby': `${id}-error`,
    }),
    el('p', { class: 'field-error', id: `${id}-error` })
  );
}

function setMode(next) {
  mode = next;
  clearErrors();
  renderDialogText();
  const target = dialog.querySelector(next === 'signup' ? '#auth-name' : '#auth-email');
  if (target) target.focus();
}

function renderDialogText() {
  if (!dialog) return;
  const signup = mode === 'signup';

  dialog.querySelector('#auth-title').textContent = t(signup ? 'auth.signupTitle' : 'auth.loginTitle');
  dialog.querySelector('#auth-submit').textContent = t(signup ? 'auth.submitSignup' : 'auth.submitLogin');
  dialog.querySelector('#auth-switch').textContent = t(signup ? 'auth.switchToLogin' : 'auth.switchToSignup');

  dialog.querySelector('#auth-name-row').hidden = !signup;
  dialog.querySelector('#auth-name').required = signup;
  dialog.querySelector('#auth-password-hint').hidden = !signup;
  dialog.querySelector('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';

  applyTranslations(dialog);
}

function openDialog(startMode) {
  mode = startMode;
  clearErrors();
  dialog.querySelector('#auth-form').reset();
  renderDialogText();
  if (!dialog.open) dialog.showModal();
  dialog.querySelector(startMode === 'signup' ? '#auth-name' : '#auth-email').focus();
}

function clearErrors() {
  for (const node of dialog.querySelectorAll('.field-error, .form-error')) showErrorCode(node, null);
  for (const input of dialog.querySelectorAll('.input')) input.removeAttribute('aria-invalid');
}

function showFieldError(name, code) {
  const input = dialog.querySelector(`#auth-${name}`);
  const message = dialog.querySelector(`#auth-${name}-error`);
  if (!input || !message) return;
  input.setAttribute('aria-invalid', 'true');
  showErrorCode(message, code);
}

function collectValues() {
  return {
    name: dialog.querySelector('#auth-name').value,
    email: dialog.querySelector('#auth-email').value,
    password: dialog.querySelector('#auth-password').value,
  };
}

function validate(values) {
  const errors = {};
  const signup = mode === 'signup';

  if (signup) {
    const nameError = validateName(values.name);
    if (nameError) errors.name = nameError;
  }
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;

  const passwordError = signup
    ? validateNewPassword(values.password)
    : validateExistingPassword(values.password);
  if (passwordError) errors.password = passwordError;

  return errors;
}

async function onSubmit(event) {
  event.preventDefault();
  if (submitting) return;

  clearErrors();
  const values = collectValues();
  const errors = validate(values);

  if (Object.keys(errors).length > 0) {
    for (const [name, code] of Object.entries(errors)) showFieldError(name, code);
    dialog.querySelector(`#auth-${Object.keys(errors)[0]}`).focus();
    return;
  }

  const signup = mode === 'signup';
  const submit = dialog.querySelector('#auth-submit');
  submitting = true;
  submit.disabled = true;
  submit.textContent = t('auth.working');

  try {
    const body = signup
      ? { name: values.name.trim(), email: values.email.trim(), password: values.password }
      : { email: values.email.trim(), password: values.password };
    const data = await api.post(signup ? '/api/auth/signup' : '/api/auth/login', body);

    const resolve = pendingResolve;
    pendingResolve = null;
    setUser(data.user);
    dialog.close();
    showToast(t('auth.welcome', { name: data.user.name }));
    if (resolve) resolve(true);
  } catch (err) {
    showServerError(err);
  } finally {
    submitting = false;
    submit.disabled = false;
    renderDialogText();
  }
}

function showServerError(err) {
  const code = (err && err.code) || 'INTERNAL_ERROR';

  if (err && err.fields) {
    for (const [name, fieldCode] of Object.entries(err.fields)) showFieldError(name, fieldCode);
  }

  const banner = dialog.querySelector('#auth-form-error');
  if (code === 'VALIDATION_ERROR' && err.fields) {
    showErrorCode(banner, 'VALIDATION_ERROR');
  } else if (code === 'EMAIL_TAKEN') {
    showFieldError('email', code);
  } else {
    showErrorCode(banner, code);
  }
}
