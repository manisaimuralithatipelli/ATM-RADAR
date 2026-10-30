// Client-side checks that mirror server/validation/schemas.js.
// They return the same error codes, so messages are translated in one place.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return 'EMAIL_REQUIRED';
  if (email.length > 254) return 'EMAIL_TOO_LONG';
  if (!EMAIL_PATTERN.test(email)) return 'INVALID_EMAIL';
  return null;
}

export function validateName(value) {
  const name = value.trim();
  if (!name) return 'NAME_REQUIRED';
  if (name.length < 2) return 'NAME_TOO_SHORT';
  if (name.length > 60) return 'NAME_TOO_LONG';
  return null;
}

export function validateNewPassword(value) {
  if (!value) return 'PASSWORD_REQUIRED';
  if (value.length < 8) return 'PASSWORD_TOO_SHORT';
  if (new TextEncoder().encode(value).length > 72) return 'PASSWORD_TOO_LONG';
  if (!/[A-Za-z]/.test(value)) return 'PASSWORD_NEEDS_LETTER';
  if (!/\d/.test(value)) return 'PASSWORD_NEEDS_NUMBER';
  return null;
}

export function validateExistingPassword(value) {
  return value ? null : 'PASSWORD_REQUIRED';
}

export function validatePincode(value) {
  const pin = value.trim();
  if (!pin) return null;
  return /^\d{6}$/.test(pin) ? null : 'INVALID_PINCODE';
}
