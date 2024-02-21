const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const {mergeChunks} = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');

// @desc      Upload avatar
// @route     PUT /api/v1/upload
// @access    Private
exports.uploadFile = asyncHandler(async (req, res, next) => {
    const chunk = req.file.buffer;
    const chunkNumber = Number(req.body.chunkNumber); // Sent from the client
    const totalChunks = Number(req.body.totalChunks); // Sent from the client
    const fileName = req.body.originalname;

    const chunkDir = path.join(__dirname, "..", "temp");

    if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir);
    }

    const chunkFilePath = path.join(chunkDir, `${fileName}.part_${chunkNumber}`);
    fs.writeFileSync(chunkFilePath, chunk);

    if (chunkNumber === totalChunks - 1) {
        await mergeChunks(fileName, totalChunks);
        return res.status(200).json("File uploaded successfully");
    }

    res.status(200).json("Chunk uploaded successfully");
});
