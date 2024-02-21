const sharp = require('sharp');
const path = require('path');
const fs = require("fs");
const multer = require('multer');

// Temporary storage configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50000000, // 50MB
    },
})

const mergeChunks = async (fileName, totalChunks) => {
    const chunkDir = path.join(__dirname, "..", "temp");
    const finalFilePath = path.join(__dirname, "..", "uploads", fileName);

    // Create a write stream for the final file
    const writeStream = fs.createWriteStream(finalFilePath);

    try {
        // Loop through all the chunks
        for (let i = 0; i < totalChunks; i++) {
            const chunkFilePath = path.join(chunkDir, `${fileName}.part_${i}`);

            // Create a read stream for the chunk file and pipe it to the write stream
            const readStream = fs.createReadStream(chunkFilePath);
            readStream.pipe(writeStream, { end: false });

            // Wait for the chunk to be fully written before continuing to the next chunk
            await new Promise((resolve, reject) => {
                readStream.on('end', resolve);
                readStream.on('error', reject);
            });

            // Delete the chunk file
            await fs.promises.unlink(chunkFilePath);
        }

        // Wait for all data to be written to the final file
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    } catch (error) {
        // If there's an error, delete the final file and rethrow the error
        writeStream.close();
        await fs.promises.unlink(finalFilePath);
        throw error;
    }

    // Close the write stream
    writeStream.end();

    return finalFilePath;
};

module.exports = {
    upload,
    mergeChunks
};
