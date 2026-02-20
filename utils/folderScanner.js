/**
 * Folder Scanner Utility
 * Scans root folder for video subfolders and extracts metadata
 */

const fs = require('fs');
const path = require('path');
const { getVideoDuration } = require('./videoDuration');

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Duration threshold for classification (in seconds)
const REEL_MAX_DURATION = 90;

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
            const filePath = path.join(folderPath, file);
            const stat = fs.statSync(filePath);
            
            // Skip directories (especially 'posted'/'Posted' folder)
            if (stat.isDirectory()) {
                continue;
            }
            
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
 * Classify content type based on file type and duration
 * @param {string} filePath - Path to media file
 * @param {number|null} duration - Video duration in seconds (null if not video or detection failed)
 * @returns {string} Content type: 'reel', 'post', or 'photo'
 */
function classifyContentType(filePath, duration) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check if it's an image file
    if (IMAGE_EXTENSIONS.includes(ext)) {
        return 'photos';
    }
    
    // It's a video file
    if (duration === null) {
        // Duration detection failed - default to reels
        console.log(`[SCANNER] Duration unknown for ${path.basename(filePath)}, defaulting to reels`);
        return 'reels';
    }
    
    // Classify by duration threshold
    if (duration < REEL_MAX_DURATION) {
        return 'reels';
    } else {
        return 'posts';
    }
}

/**
 * Scan root folder for video subfolders
 * @param {string} rootPath - Path to root folder
 * @returns {Promise<Array>} Array of folder objects
 */
async function scanFolders(rootPath) {
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

            // Get video path
            const videoPath = path.join(itemPath, videoFile);

            // Detect video duration
            let duration = null;
            let contentType = 'reel'; // Default fallback
            
            try {
                duration = await getVideoDuration(videoPath);
                contentType = classifyContentType(videoPath, duration);
                
                if (duration !== null) {
                    console.log(`[SCANNER] ${item}: ${duration.toFixed(1)}s → ${contentType}`);
                }
            } catch (durationError) {
                console.warn(`[SCANNER] Could not detect duration for ${item}: ${durationError.message}`);
                // contentType remains 'reel' as default
            }

            // Add to results
            results.push({
                folderName: item,
                folderPath: itemPath,
                videoFile: videoFile,
                videoPath: videoPath,
                caption: caption,
                captionPreview: caption.substring(0, 50) + (caption.length > 50 ? '...' : ''),
                isPosted: isPosted,
                contentType: contentType,  // NEW: reel, post, or photo
                duration: duration  // NEW: duration in seconds (or null)
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
