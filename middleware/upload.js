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
        fs.mkdirSync(mergedFilePath);
    }

    const writeStream = fs.createWriteStream(`${mergedFilePath}/${fileName}`);
    for (let i = 0; i < totalChunks; i++) {
        const chunkFilePath = `${chunkDir}/${fileName}.part_${i}`;
        const chunkBuffer = await fs.promises.readFile(chunkFilePath);
        writeStream.write(chunkBuffer);
        fs.unlinkSync(chunkFilePath); // Delete the individual chunk file after merging
    }

    writeStream.end();
    console.log("Chunks merged successfully");
};

module.exports = {
    upload,
    mergeChunks
};
