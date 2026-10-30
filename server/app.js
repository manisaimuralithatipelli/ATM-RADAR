'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundApi } = require('./middleware/errorHandler');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Clean URLs for every page. Refreshing or opening any of these directly works.
const PAGES = {
  '/': 'index.html',
  '/why-this': 'why-this.html',
  '/privacy': 'privacy.html',
  '/terms': 'terms.html',
};

function leafletDistDir() {
  try {
    return path.join(path.dirname(require.resolve('leaflet/package.json')), 'dist');
  } catch (err) {
    console.warn('Leaflet is not installed. Run "npm install" so the map can load.');
    return null;
  }
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      // OpenStreetMap tile servers require a Referer header, so no-referrer would block tiles
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          // A wildcard like *.tile.openstreetmap.org does NOT match tile.openstreetmap.org itself,
          // and the map requests tiles from the bare host, so both are listed.
          imgSrc: [
            "'self'",
            'data:',
            'https://tile.openstreetmap.org',
            'https://*.tile.openstreetmap.org',
          ],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: env.isProd ? [] : null,
        },
      },
    })
  );

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  // API
  app.use('/api', apiLimiter, routes);
  app.use('/api', notFoundApi);

  // Leaflet is served from our own origin so the strict CSP can stay in place
  const leaflet = leafletDistDir();
  if (leaflet) {
    app.use('/vendor/leaflet', express.static(leaflet, { maxAge: env.isProd ? '7d' : 0 }));
  }

  // Static assets and pages
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: env.isProd ? '1h' : 0 }));

  for (const [route, file] of Object.entries(PAGES)) {
    app.get(route, (req, res, next) => {
      res.sendFile(path.join(PUBLIC_DIR, file), (err) => {
        if (!err) return;
        if (err.code === 'ENOENT' || err.status === 404) return next();
        return next(err);
      });
    });
  }

  // Unknown pages get a friendly 404 page with the normal header and footer
  app.use((req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'), (err) => {
      if (err && !res.headersSent) res.type('text/plain').send('Page not found');
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
