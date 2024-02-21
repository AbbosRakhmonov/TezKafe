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


    // Check if chunkDir exists, if not, create it
    if (!fs.existsSync(chunkDir)) {
        await fs.promises.mkdir(chunkDir);
    }

    // Write the chunk data to a file
    const chunkFilePath = path.join(chunkDir, `${fileName}.part_${chunkNumber}`);
    await fs.promises.writeFile(chunkFilePath, chunk);

    if (chunkNumber === totalChunks - 1) {
        // Merge all chunks
        await mergeChunks(fileName, totalChunks);
        const fileSize = fs.statSync(path.join(__dirname, "..", "uploads", fileName)).size;
        // await File.create({name: mergedFileName});
        // Send response back to client
        res.status(200).json({
            fileName,
            fileSize
        });
    } else {
        res.status(200).json(`Chunk ${chunkNumber} of ${totalChunks} saved`);
    }

});
