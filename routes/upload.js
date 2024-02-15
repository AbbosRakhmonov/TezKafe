const express = require('express');
const router = express.Router();
const {protect} = require('../middleware/auth');
const {uploadFile} = require('../controllers/upload');
const {upload} = require('../middleware/upload');

router.post('/', protect, upload.single('file'), uploadFile);

module.exports = router;