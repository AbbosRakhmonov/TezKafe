const fs = require('fs').promises
const path = require('path');
const cron = require('node-cron');
const File = require('../models/File');

async function deleteAllFilesInDir(dirPath) {
    try {
        const files = await fs.readdir(dirPath);

        const deleteFilePromises = files.map(file =>
            fs.rm(path.join(dirPath, file), {
                recursive: true,
                force: true
            }),
        );

        await Promise.all(deleteFilePromises);
    } catch (err) {
        console.log(err);
    }
}

const deleteUnusedFiles = async () => {
    console.log('Running a daily check for uncompleted videos.');

    try {
        // delete unused files from DB and disk
        const unusedFiles = await File.find({inuse: false});
        const unusedFilesIds = unusedFiles.map(file => file._id);
        await File.deleteMany({_id: {$in: unusedFilesIds}});
        const unusedFilesPaths = unusedFiles.map(file => file.path);
        const deleteUnusedFilesPromises = unusedFilesPaths.map(filePath => fs.unlink(filePath));
        await Promise.all(deleteUnusedFilesPromises);
        // clear temp folder
        const tempFolder = path.join(__dirname, '..', 'temp');
        await deleteAllFilesInDir(tempFolder);
        console.log('Daily check for unused files completed.');
    } catch (error) {
        console.error('Error during daily check for unused files:', error);
    }
};

// Schedule the task to run at midnight every day
cron.schedule('0 0 * * *', deleteUnusedFiles);

module.exports = deleteUnusedFiles;

