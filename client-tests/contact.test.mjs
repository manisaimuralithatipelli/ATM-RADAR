import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadClientModule } from './load-modules.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('valid LinkedIn, GitHub, and email values become safe links, in that order', async () => {
  const { contactLinks } = await loadClientModule('layout.js');
  const links = contactLinks({
    email: 'name@gmail.com',
    github: 'https://github.com/someone/',
    linkedin: 'https://www.linkedin.com/in/some-one-123/',
  });
  assert.deepEqual(links.map((l) => [l.key, l.icon, l.href, l.text, l.external]), [
    ['footer.linkedin', 'linkedin', 'https://www.linkedin.com/in/some-one-123/', 'linkedin.com/in/some-one-123', true],
    ['footer.github', 'github', 'https://github.com/someone/', 'github.com/someone', true],
    ['footer.email', 'mail', 'mailto:name@gmail.com', 'name@gmail.com', false],
  ]);
});

test('empty values hide the links', async () => {
  const { contactLinks } = await loadClientModule('layout.js');
  assert.deepEqual(contactLinks({ email: '', github: '', linkedin: '' }), []);
  assert.deepEqual(contactLinks(), []);
});

test('unsafe or mistyped values are ignored', async () => {
  const { contactLinks } = await loadClientModule('layout.js');
  const bad = contactLinks({
    email: 'not an email',
    github: 'javascript:alert(1)',
    linkedin: 'http://www.linkedin.com/in/x',
  });
  assert.deepEqual(bad, []);
  assert.deepEqual(contactLinks({ github: 'https://evil.example/github.com/x' }), []);
  assert.deepEqual(contactLinks({ github: 'https://user:pass@github.com/x' }), []);
  assert.deepEqual(contactLinks({ linkedin: 'https://linkedin.com.evil.example/in/x' }), []);
  assert.deepEqual(contactLinks({ email: 'a"b@x.com' }), []);
  assert.deepEqual(contactLinks({ email: 'a@b' }), []);
});

test('the configured details in site-config.js are all accepted', async () => {
  const { contactLinks } = await loadClientModule('layout.js');
  const config = await loadClientModule('site-config.js');
  const links = contactLinks({ email: config.DEVELOPER_EMAIL, github: config.DEVELOPER_GITHUB, linkedin: config.DEVELOPER_LINKEDIN });
  assert.equal(links.length, 3, 'one of the email, GitHub, or LinkedIn values is invalid');
  assert.ok(config.DEVELOPER_NAME && !/YOUR NAME/.test(config.DEVELOPER_NAME), 'developer name still a placeholder');
});

test('every contact label key exists in all three languages', () => {
  for (const lang of ['en', 'te', 'hi']) {
    const footer = JSON.parse(fs.readFileSync(path.join(publicDir, 'locales', `${lang}.json`), 'utf8')).footer;
    for (const key of ['email', 'github', 'linkedin']) assert.ok(footer[key], `${lang} footer.${key}`);
  }
});

test('initials come from the first and last word of the name', async () => {
  const { initialsOf } = await loadClientModule('layout.js');
  assert.equal(initialsOf('THATIPELLI MANI SAI MURALI'), 'TM');
  assert.equal(initialsOf('Murali'), 'M');
  assert.equal(initialsOf('  ada   lovelace '), 'AL');
  assert.equal(initialsOf(''), '');
  assert.equal(initialsOf(undefined), '');
});

test('only local image files are accepted for the photo', async () => {
  const { isLocalImagePath } = await loadClientModule('layout.js');
  assert.equal(isLocalImagePath('/images/developer.jpg'), true);
  assert.equal(isLocalImagePath('/images/me.PNG'), true);
  assert.equal(isLocalImagePath('/images/me.webp'), true);
  assert.equal(isLocalImagePath(''), false);
  assert.equal(isLocalImagePath('images/developer.jpg'), false);
  assert.equal(isLocalImagePath('//evil.example/a.jpg'), false);
  assert.equal(isLocalImagePath('https://media.licdn.com/a.jpg'), false);
  assert.equal(isLocalImagePath('/images/../server/app.js'), false);
  assert.equal(isLocalImagePath('/images/a.jpg?x=1'), false);
  assert.equal(isLocalImagePath('javascript:alert(1)'), false);
  assert.equal(isLocalImagePath(null), false);
});

test('the configured photo path is accepted', async () => {
  const { isLocalImagePath } = await loadClientModule('layout.js');
  const config = await loadClientModule('site-config.js');
  assert.equal(isLocalImagePath(config.DEVELOPER_PHOTO), true);
});
