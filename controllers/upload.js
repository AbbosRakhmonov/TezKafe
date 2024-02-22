const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');
const tempDir = path.join(__dirname, '..', 'temp');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const sharp = require('sharp');

// Ensure directories exist
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// @desc      Upload avatar
// @route     PUT /api/v1/upload
// @access    Private
exports.uploadFile = asyncHandler(async (req, res, next) => {
    const chunkNumber = Number(req.body.chunkNumber);
    const totalChunks = Number(req.body.totalChunks);
    const fileName = req.body.originalname;
    const fileId = req.body.fileId;

    const tempFilePath = path.join(tempDir, fileId);
    if (!fs.existsSync(tempFilePath)) {
        fs.mkdirSync(tempFilePath);
    }
    let filePath = path.join(tempFilePath, fileName)
    try {
        const writeStream = fs.createWriteStream(filePath, {flags: 'a'}); // 'a' for append mode
        writeStream.write(req.file.buffer);
        // Handle errors
        writeStream.on('error', (error) => {
            console.error('Error writing to file:', error);
            fs.rmSync(tempFilePath, {recursive: true, force: true});
            return next(new ErrorResponse(error, 500));
        });

        writeStream.on('finish', async () => {
            if (chunkNumber === totalChunks - 1) {
                const fileBuffer = fs.readFileSync(filePath);
                let newFileName = fileName.split('.').slice(0, -1).join('.')
                await sharp(fileBuffer)
                    .webp({lossless: true, quality: 90})
                    .toFile(path.join(uploadsDir, `${newFileName}.webp`))
                fs.rmSync(tempFilePath, {recursive: true, force: true});
                let newFile = await File.create({name: `${newFileName}.webp`})
                return res.status(201).json(newFile.name)
            } else {
                res.status(200).json({message: "Chunk uploaded successfully"});
            }
        });
        writeStream.end();
    } catch (e) {
        fs.rmSync(tempFilePath, {recursive: true, force: true})
        return next(new ErrorResponse(e, 500))
    }

});
