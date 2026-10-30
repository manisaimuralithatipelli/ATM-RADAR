'use strict';

const router = require('express').Router();
const atmController = require('../controllers/atm.controller');
const reportController = require('../controllers/report.controller');
const validate = require('../middleware/validate');
const requireJson = require('../middleware/requireJson');
const { requireAuth } = require('../middleware/auth');
const { reportLimiter } = require('../middleware/rateLimit');
const { atmQuery, idParams, reportBody } = require('../validation/schemas');

router.get('/', validate(atmQuery, 'query'), atmController.list);
router.get('/meta', atmController.meta);
router.get('/:id', validate(idParams, 'params'), atmController.getOne);
router.post(
  '/:id/reports',
  reportLimiter,
  requireAuth,
  requireJson,
  validate(idParams, 'params'),
  validate(reportBody),
  reportController.create
);

module.exports = router;
