'use strict';

const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const { authenticate, requirePermission } = require('../middlewares/auth');
const controller = require('../controllers/mediaController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxFileSizeBytes, files: 1 },
});

const router = express.Router();
router.use(authenticate);

router.post('/objects', requirePermission('media', 'write'), upload.single('file'), controller.upload);
router.post('/upload', requirePermission('media', 'write'), upload.single('file'), controller.upload);
router.post('/upload/:category', requirePermission('media', 'write'), upload.single('file'), controller.upload);

router.get('/objects', requirePermission('media', 'read'), controller.list);
router.get('/objects/:id/presign', requirePermission('media', 'read'), controller.presign);
router.get('/objects/:id/content', requirePermission('media', 'read'), controller.content);
router.get('/objects/:id', requirePermission('media', 'read'), controller.get);
router.delete('/objects/:id', requirePermission('media', 'delete'), controller.remove);

module.exports = router;
