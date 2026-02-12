/**
 * Video Duration Detection Utility
 * Uses FFprobe to detect video duration in seconds
 * 
 * INSTALLATION INSTRUCTIONS:
 * FFprobe is part of FFmpeg. To install:
 * 
 * Windows:
 * 1. Download FFmpeg from https://ffmpeg.org/download.html
 * 2. Extract and add the bin folder to your PATH
 * 3. Verify by running: ffprobe -version
 * 
 * Alternative: Use Chocolatey
 * choco install ffmpeg
 * 
 * If FFprobe is not installed, this module will return null and the system
 * will default to using the Reel workflow for all videos.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const logger = require('./logger');

/**
 * Get video duration in seconds using FFprobe
 * @param {string} videoPath - Absolute path to video file
 * @returns {Promise<number|null>} Duration in seconds, or null if detection fails
 */
async function getVideoDuration(videoPath) {
    // Check if file exists first
    if (!fs.existsSync(videoPath)) {
        logger.error(`[DURATION] Video file not found: ${videoPath}`);
        return null;
    }

    return new Promise((resolve) => {
        logger.log(`[DURATION] Detecting video duration: ${videoPath}`);

        // Spawn FFprobe process
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);

        let output = '';
        let errorOutput = '';

        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0 && output.trim()) {
                const duration = parseFloat(output.trim());
                if (!isNaN(duration)) {
                    logger.success(`[DURATION] ✅ Video duration: ${duration.toFixed(2)}s`);
                    resolve(duration);
                } else {
                    logger.warn(`[DURATION] Could not parse duration: ${output}`);
                    resolve(null);
                }
            } else {
                // Check if error is due to missing FFprobe
                if (errorOutput.includes('not found') || errorOutput.includes('not recognized')) {
                    logger.warn('[DURATION] FFprobe not found. Please install FFmpeg.');
                    logger.warn('[DURATION] Download from: https://ffmpeg.org/download.html');
                    logger.warn('[DURATION] Defaulting to Reel workflow for all videos.');
                } else if (code !== 0) {
                    logger.warn(`[DURATION] FFprobe error (code ${code}): ${errorOutput}`);
                } else {
                    logger.warn('[DURATION] Could not detect video duration');
                }
                resolve(null);
            }
        });

        ffprobe.on('error', (err) => {
            // This typically happens when FFprobe is not installed
            if (err.code === 'ENOENT') {
                logger.warn('[DURATION] ⚠️ FFprobe not installed. Install FFmpeg to enable auto-routing.');
                logger.warn('[DURATION] Defaulting to Reel workflow for all videos.');
            } else {
                logger.warn(`[DURATION] Error running FFprobe: ${err.message}`);
            }
            resolve(null);
        });

        // Set timeout of 10 seconds
        setTimeout(() => {
            ffprobe.kill();
            logger.warn('[DURATION] FFprobe timeout, could not detect duration');
            resolve(null);
        }, 10000);
    });
}

module.exports = {
    getVideoDuration
};
