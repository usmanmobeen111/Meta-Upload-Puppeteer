/**
 * Status Marker Utility
 * Manages posted status for video folders
 */

const fs = require('fs');
const path = require('path');

/**
 * Get current timestamp in YYYY-MM-DD HH:mm:ss format
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Mark folder as posted
 * @param {string} folderPath - Path to video folder
 * @param {string} videoFileName - Name of the video file that was posted
 */
function markAsPosted(folderPath, videoFileName) {
    try {
        // Create posted directory if it doesn't exist
        const postedDir = path.join(folderPath, 'posted');
        if (!fs.existsSync(postedDir)) {
            fs.mkdirSync(postedDir, { recursive: true });
        }

        // Create status.json
        const statusPath = path.join(postedDir, 'status.json');
        const statusData = {
            posted: true,
            postedAt: getTimestamp(),
            platform: 'Meta Business Suite',
            videoFile: videoFileName
        };

        fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2), 'utf8');

        return true;
    } catch (error) {
        throw new Error(`Failed to mark as posted: ${error.message}`);
    }
}

/**
 * Check if folder is marked as posted
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
        return false;
    }
}

module.exports = {
    markAsPosted,
    checkIfPosted
};
