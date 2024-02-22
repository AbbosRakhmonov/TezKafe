const multer = require('multer');

// Temporary storage configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50000000, // 50MB
    },
})

module.exports = {
    upload,
};
