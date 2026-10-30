# ATM RADAR

Smart ATM Cash Availability Finder. Find ATMs. Check Cash. Go Smarter.

ATM records and statuses are simulated and are not live bank data.

## Run locally

1. Install Node.js 18 or newer and MongoDB (local or Atlas).
2. `npm install`
3. Copy `.env.example` to `.env`, then set `JWT_SECRET` (the example file shows how to generate one) and `MONGODB_URI`.
4. `npm run seed` loads the sample Warangal ATMs and creates simulated statuses.
5. `npm run dev`, then open http://localhost:3000
6. `npm test` runs the status logic tests and the frontend tests (translations, formatting, validation).

## Developer photo and links

The footer shows a developer card: photo, name, tagline, then LinkedIn, GitHub, and Email buttons.

1. Save your photo as `public/images/developer.jpg` (square, at least 256 x 256 pixels, under 200 KB). You can save your LinkedIn profile photo from your own profile page and crop it square.
2. That is all. `DEVELOPER_PHOTO` in `public/js/site-config.js` already points to that file. Until the file exists, your initials are shown instead, so nothing looks broken.
3. Name, tagline, and links are in the same file. Leave a link empty (`''`) to hide it.

The photo must be a file inside `public/`. Do not link a LinkedIn photo address directly: LinkedIn blocks that, and the page's security policy only allows images from this site.

## Languages

English, Telugu, and Hindi. All text lives in `public/locales/en.json`, `te.json`, and `hi.json`. The selector in the header switches language instantly, and the choice is saved in the browser (localStorage key `atmradar.lang`).

- To change wording, edit the JSON files. Do not put text in the JavaScript.
- Keep the same keys in all three files. `npm test` fails if a key, a placeholder like `{count}`, or a plural pair (`_one` and `_other`) is missing.
- The Telugu and Hindi text was written by an AI and has not been reviewed by a native speaker. Have it reviewed before launch.
- ATM names, banks, and addresses come from the database and are never translated.
- The API sends error codes, not sentences, so messages always follow the selected language. Language never affects status calculation.

## Light and dark mode

The "Dark mode" button in the header switches themes. A first visit follows the operating system setting. After you press the button your choice is saved (localStorage key `atmradar.theme`) and wins over the system setting. Without a saved choice the page follows live system changes.

- `public/js/theme-init.js` is a small blocking script in `<head>`. It sets the theme before the first paint, so there is no flash of the wrong colours. Add it to the `<head>` of every new page, before the stylesheets.
- All colours are variables in `public/css/theme.css` (light values, then dark overrides). Use these variables instead of fixed colours in new CSS.
- `npm test` checks the colour pairs for WCAG AA contrast in both themes.
- The map keeps its original OpenStreetMap tiles. In dark mode a CSS filter darkens them, and the zoom buttons and attribution use theme colours (`public/css/map.css`).

## Pages and routes

| Route | File | Content |
| --- | --- | --- |
| / | public/index.html | Search, filters, near me, map, ATM details, reports, login |
| /why-this | public/why-this.html | Purpose, how it works, data transparency, limits |
| /privacy | public/privacy.html | Privacy and disclaimer |
| /terms | public/terms.html | Terms and conditions |
| any other address | public/404.html | Page not found, with the normal header and footer |

Every page shares the header (language selector, dark mode button, login) and the footer, both built in `public/js/layout.js`. Your name, tagline, email, GitHub, and LinkedIn links are set in `public/js/site-config.js` (leave a value empty to hide it). The course line is `footer.courseValue` in `public/locales/*.json`, and the copyright line is `footer.copyright`. The developer photo goes in `public/images/` (see below). To change the date shown on the Privacy and Terms pages, edit `LEGAL_LAST_UPDATED` in the same file.

The map loads Leaflet from `/vendor/leaflet` (installed by `npm install`) and OpenStreetMap tiles. If Leaflet is missing, the list still works and a message replaces the map.

### Map behaviour and troubleshooting

- ATMs that would overlap on screen are merged into one numbered blue pin. Press it to zoom in. Pins split as you zoom, and from street level every ATM has its own pin. Choosing an ATM from the list zooms to it. Pressing a pin does not move the map.
- Tiles come from `https://tile.openstreetmap.org`. The page's security policy (`imgSrc` in `server/app.js`) must list that exact host. A wildcard such as `*.tile.openstreetmap.org` does not match it. `npm test` checks this.
- If the map area is blank but pins appear, open the browser developer tools Console. A message starting "Refused to load the image" means the security policy blocks the tiles. A "net::ERR" message means the network or OpenStreetMap is unreachable.
- OpenStreetMap's tile servers are for light use. For a busy public site, use a tile provider that allows it.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | /api/health | Server and database state |
| POST | /api/auth/signup | name, email, password. Sets an httpOnly cookie |
| POST | /api/auth/login | email, password |
| POST | /api/auth/logout | Clears the cookie |
| GET | /api/auth/me | Current user, or `user: null` when logged out |
| GET | /api/atms | Query: q, bank, pincode, status, lat, lng, radius, limit |
| GET | /api/atms/meta | Banks, areas, PIN codes for filters |
| GET | /api/atms/:id | One ATM with recent reports |
| POST | /api/atms/:id/reports | Login required. Body: status (AVAILABLE or UNAVAILABLE) |

Errors return `{ "error": { "code": "...", "message": "..." } }`. Validation errors add a `fields` object of codes. The frontend translates codes, so the API never depends on the interface language.

## Status rules

- The newest report within the validity window (default 60 minutes) decides AVAILABLE or UNAVAILABLE.
- With no valid report the status is UNKNOWN.
- Reliability: SIMULATED for simulated reports. For community reports, HIGH needs 3 agreeing and none contradicting, MEDIUM needs 2 agreeing and more than contradicting, otherwise LOW.
- Rules live in `server/services/status.js` and have no language or theme input.

## Before launch

Done in the code: favicon, Privacy page, Terms page, no "made with" labels, no gradients or animations, no fake numbers or reviews (`npm test` checks the AI-tag and style rules).

Still to do by you:

1. Check your details in `public/js/site-config.js` and add your photo at `public/images/developer.jpg`.
2. Connect your custom domain at your hosting provider and use HTTPS. Location search only works on HTTPS pages.
3. Set `NODE_ENV=production`, `TRUST_PROXY=1` behind a proxy, and a strong `JWT_SECRET` in the hosting settings. Use MongoDB Atlas or another hosted database.
4. Verify or replace the sample coordinates and PIN codes in `server/seed/atms.js`, then run `npm run seed`.
5. Have a native speaker review the Telugu and Hindi text in `public/locales/`.
6. Read the Privacy and Terms pages and update them if the app changes. They tell people to contact whoever runs the site, and your email is in the footer of every page.
7. After unzipping, run `npm install` and `npm test`. If the favicon fails the AI-tag test, replace `public/favicon.svg` with a clean copy.
8. Check the real map and the dark-mode map tiles in a browser, and try the report flow end to end.
