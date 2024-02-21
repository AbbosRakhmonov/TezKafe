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

const getMetaData = async (file) => {
    try {
        return await sharp(file).metadata();
    } catch (error) {
        throw new Error(error);
    }
}

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

    let file = path.join(__dirname, "..", "uploads", fileName);
    let newFileName = fileName.replace(/\.[^/.]+$/, "") + `-${new Date().toLocaleDateString('RU')}` + ".webp";
    let metadata = await getMetaData(file);
    //     resize and save
    await sharp(file)
        .resize({width: metadata.width / 2, kernel: sharp.kernel.lanczos3})
        .webp({quality: 90})
        .toFile(path.join(__dirname, "..", "uploads", newFileName));
    //     delete the original file
    fs.unlinkSync(file);
    return newFileName;
};

module.exports = {
    upload,
    mergeChunks
};
