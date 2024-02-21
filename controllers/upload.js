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

    const chunkFilePath = `${chunkDir}/${fileName}.part_${chunkNumber}`;

    try {
        await fs.promises.writeFile(chunkFilePath, chunk);
        console.log(`Chunk ${chunkNumber}/${totalChunks} saved`);

        if (chunkNumber === totalChunks - 1) {
            // If this is the last chunk, merge all chunks into a single file
            await mergeChunks(fileName, totalChunks);
            console.log("File merged successfully");
        }

        res.status(200).json({message: "Chunk uploaded successfully"});
    } catch (error) {
        console.error("Error saving chunk:", error);
        res.status(500).json({error: "Error saving chunk"});
    }
});
