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


    // get the file
    let file = path.join(__dirname, "..", "uploads", fileName);
    let newFileName = fileName.replace(/\.[^/.]+$/, "") + `-${new Date().toISOString()}` + (convertToWebp ? ".webp" : "");
    //     resize and save
    await sharp(file)
        .webp({quality: 90})
        .toFile(path.join(__dirname, "..", "uploads", newFileName));
    //     delete the original file
    await fs.promises.unlink(file);

    return newFileName;
};

module.exports = {
    upload,
    mergeChunks
};
