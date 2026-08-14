'use strict';

const express = require('express');
const mediaRoutes = require('./mediaRoutes');

const router = express.Router();
router.use('/', mediaRoutes);

module.exports = router;
