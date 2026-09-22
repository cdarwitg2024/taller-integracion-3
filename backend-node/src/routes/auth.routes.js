const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/auth.controller');
const { autenticarToken } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', autenticarToken, me);

module.exports = router;