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
        const buffer = req.file.buffer;

        if (!buffer || buffer.length === 0) {
            return new ErrorResponse('Buffer is empty', 400)
        }
        const writeStream = fs.createWriteStream(filePath, {flags: 'a'}); // 'a' for append mode
        writeStream.write(buffer);
        // Handle errors
        writeStream.on('error', (error) => {
            console.error('Error writing to file:', error);
            fs.rmSync(tempFilePath, {recursive: true, force: true});
            return next(new ErrorResponse(error, 500));
        });

        writeStream.on('finish', async () => {
            if (chunkNumber === totalChunks - 1) {
                const fileBuffer = fs.readFileSync(filePath);
                let newFileName = fileName.split('.').slice(0, -1).join('.') + '.jpg'
                const metadata = await sharp(fileBuffer).metadata();
                await sharp(fileBuffer)
                    .jpeg({
                        quality: 80, // Adjust quality as needed (0 to 100)
                        progressive: true, // Use progressive (interlace) scan for JPEG
                        chromaSubsampling: '4:2:0', // Chroma subsampling mode
                        trellisQuantisation: true, // Enable trellis quantisation
                        overshootDeringing: true, // Enable overshoot deringing
                        optimizeScans: true, // Optimize scans
                    })
                    .toFile(path.join(uploadsDir, newFileName))
                await File.create({name: newFileName})
                fs.rmSync(tempFilePath, {recursive: true, force: true});
                return res.status(201).json(newFileName)
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
