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
    const mergedFilePath = path.join(__dirname, "..", "uploads");


    if (!fs.existsSync(mergedFilePath)) {
        await fs.promises.mkdir(mergedFilePath);
    }

    const writeStream = fs.createWriteStream(`${mergedFilePath}/${fileName}`);


    for (let i = 0; i < totalChunks; i++) {
        const chunkFilePath = `${chunkDir}/${fileName}.part_${i}`;
        try {
            const chunkBuffer = await fs.promises.readFile(chunkFilePath);
            writeStream.write(chunkBuffer);
            await fs.promises.unlink(chunkFilePath); // Delete the individual chunk file after merging
        } catch (error) {
            console.error(`Error processing chunk ${i}:`, error);
            throw error;
        }
    }

    writeStream.end();

    // // change fileName to fileName-<timestamp>.<ext>
    // const fileExt = path.extname(fileName);
    // const fileNameWithoutExt = path.basename(fileName, fileExt);
    // const newFileName = `${fileNameWithoutExt}-${Date.now()}${fileExt}`;
    //
    // // save the file with the new name
    // await fs.promises.rename(`${mergedFilePath}/${fileName}`, `${mergedFilePath}/${newFileName}`);

    return fileName;
};

module.exports = {
    upload,
    mergeChunks
};
