const express = require('express');
const router = express.Router();
const packageJson = require('../../package.json');

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'backend-cafeteria',
    version: packageJson.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

module.exports = router;