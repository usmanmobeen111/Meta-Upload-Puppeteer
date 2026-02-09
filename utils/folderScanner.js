/**
 * Folder Scanner Utility
 * Scans root folder for video subfolders and extracts metadata
 */

const fs = require('fs');
const path = require('path');

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];

/**
 * Check if a folder has been marked as posted
 * @param {string} folderPath - Path to video folder
 * @returns {boolean} True if posted
 */
function checkIfPosted(folderPath) {
    try {
        const statusPath = path.join(folderPath, 'posted', 'status.json');

        if (!fs.existsSync(statusPath)) {
            return false;
        }

        const statusContent = fs.readFileSync(statusPath, 'utf8');
        const statusData = JSON.parse(statusContent);

        return statusData.posted === true;
    } catch (error) {
        // If error reading status, assume not posted
        return false;
    }
}

/**
 * Find video file in folder
 * @param {string} folderPath - Path to video folder
 * @returns {string|null} Video filename or null if not found
 */
function findVideoFile(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (VIDEO_EXTENSIONS.includes(ext)) {
                return file;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Read caption file
 * @param {string} folderPath - Path to video folder
 * @returns {string} Caption text or empty string
 */
function readCaption(folderPath) {
    try {
        const captionPath = path.join(folderPath, 'caption.txt');

        if (!fs.existsSync(captionPath)) {
            return '';
        }

        return fs.readFileSync(captionPath, 'utf8').trim();
    } catch (error) {
        return '';
    }
}

/**
 * Scan root folder for video subfolders
 * @param {string} rootPath - Path to root folder
 * @returns {Array} Array of folder objects
 */
function scanFolders(rootPath) {
    const results = [];

    try {
        if (!fs.existsSync(rootPath)) {
            throw new Error(`Root path does not exist: ${rootPath}`);
        }

        const items = fs.readdirSync(rootPath);

        for (const item of items) {
            const itemPath = path.join(rootPath, item);

            // Check if it's a directory
            const stat = fs.statSync(itemPath);
            if (!stat.isDirectory()) {
                continue;
            }

            // Look for video file
            const videoFile = findVideoFile(itemPath);
            if (!videoFile) {
                continue; // Skip folders without video files
            }

            // Read caption
            const caption = readCaption(itemPath);

            // Check posted status
            const isPosted = checkIfPosted(itemPath);

            // Add to results
            results.push({
                folderName: item,
                folderPath: itemPath,
                videoFile: videoFile,
                videoPath: path.join(itemPath, videoFile),
                caption: caption,
                captionPreview: caption.substring(0, 50) + (caption.length > 50 ? '...' : ''),
                isPosted: isPosted
            });
        }

        return results;
    } catch (error) {
        throw new Error(`Error scanning folders: ${error.message}`);
    }
}

module.exports = {
    scanFolders,
    checkIfPosted,
    findVideoFile,
    readCaption
};
