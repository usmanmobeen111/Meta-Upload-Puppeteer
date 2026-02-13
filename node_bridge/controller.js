/**
 * Node.js Controller for Python Bridge
 * CLI entry point that Python can call to control the automation
 */

const path = require('path');
const fs = require('fs');
const JSONLogger = require('./json_logger');
const ProgressReporter = require('./progress_reporter');

// Import existing utilities
const { scanFolders } = require('../utils/folderScanner');
const AdsPowerClient = require('../automation/adsPowerClient');

// JSON logger instance
const logger = new JSONLogger();
const progress = new ProgressReporter(logger);

/**
 * Load configuration
 */
function loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    
    if (!fs.existsSync(configPath)) {
        logger.error('config.json not found. Please configure the application first.');
        process.exit(1);
    }

    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        logger.error(`Failed to load config.json: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Post a single video
 */
async function postSingle(folderPath) {
    try {
        const config = loadConfig();
        
        logger.log(`Starting single video post: ${folderPath}`);
        progress.report('start');

        // Dynamically import uploader
        const MetaReelsUploader = require('../automation/uploader');
        const uploader = new MetaReelsUploader(config);

        // Scan the folder to get video data
        const folderName = path.basename(folderPath);
        const videoFiles = fs.readdirSync(folderPath).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.mov', '.avi', '.mkv'].includes(ext);
        });

        if (videoFiles.length === 0) {
            throw new Error(`No video files found in: ${folderPath}`);
        }

        const videoFile = videoFiles[0];
        const videoPath = path.join(folderPath, videoFile);
        
        // Get caption from caption.txt
        const captionPath = path.join(folderPath, 'caption.txt');
        let caption = '';
        if (fs.existsSync(captionPath)) {
            caption = fs.readFileSync(captionPath, 'utf8').trim();
        }

        const videoData = {
            folderName,
            folderPath,
            videoFile,
            videoPath,
            caption
        };

        logger.log(`Uploading: ${folderName}`);
        logger.log(`Video file: ${videoFile}`);
        logger.log(`Caption: ${caption.substring(0, 50)}...`);

        // Upload the video
        await uploader.uploadVideo(videoData);

        logger.complete(`Successfully posted: ${folderName}`);
        logger.videoStatus(folderName, 'posted');
        progress.report('confirm_posted');

    } catch (error) {
        logger.fail(`Failed to post video: ${error.message}`, { error: error.stack });
        process.exit(1);
    }
}

/**
 * Post all unposted videos from a folder
 */
async function postAll(uploadFolder) {
    try {
        const config = loadConfig();
        
        logger.log(`Scanning upload folder: ${uploadFolder}`);
        progress.report('start');

        // Scan for video folders
        const videoFolders = scanFolders(uploadFolder);
        logger.log(`Found ${videoFolders.length} video folder(s)`);

        // Filter unposted videos
        const unpostedVideos = videoFolders.filter(folder => {
            const statusPath = path.join(folder.folderPath, 'Posted', 'status.json');
            return !fs.existsSync(statusPath);
        });

        logger.log(`Unposted videos: ${unpostedVideos.length}`);

        if (unpostedVideos.length === 0) {
            logger.log('No unposted videos to process');
            return;
        }

        // Dynamically import uploader
        const MetaReelsUploader = require('../automation/uploader');
        const uploader = new MetaReelsUploader(config);

        // Post each video
        for (let i = 0; i < unpostedVideos.length; i++) {
            const videoData = unpostedVideos[i];
            
            logger.log(`\n[${i + 1}/${unpostedVideos.length}] Processing: ${videoData.folderName}`);
            logger.videoStatus(videoData.folderName, 'processing');
            
            try {
                await uploader.uploadVideo(videoData);
                logger.complete(`Posted: ${videoData.folderName}`);
                logger.videoStatus(videoData.folderName, 'posted');
            } catch (error) {
                logger.error(`Failed to post ${videoData.folderName}: ${error.message}`);
                logger.videoStatus(videoData.folderName, 'failed', { error: error.message });
            }
        }

        logger.complete(`Batch posting completed. Posted ${unpostedVideos.length} video(s)`);
        progress.report('confirm_posted');

    } catch (error) {
        logger.fail(`Failed to post all videos: ${error.message}`, { error: error.stack });
        process.exit(1);
    }
}

/**
 * Test AdsPower connection
 */
async function testAdsPower() {
    try {
        const config = loadConfig();
        
        logger.log('Testing AdsPower connection...');
        
        const client = new AdsPowerClient(config.adspowerApiKey);
        
        // Try to start the profile
        logger.log(`Starting profile: ${config.adspowerProfileId}`);
        const profileData = await client.startProfile(config.adspowerProfileId);
        
        logger.success('✅ AdsPower connection successful!');
        logger.log(`Profile started. Debug port: ${profileData.debugPort || 'N/A'}`);
        
        // Stop the profile
        await client.stopProfile(config.adspowerProfileId);
        logger.log('Profile stopped.');
        
        logger.complete('AdsPower test completed successfully');

    } catch (error) {
        logger.fail(`AdsPower connection failed: ${error.message}`, { error: error.stack });
        process.exit(1);
    }
}

/**
 * Main CLI handler
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        logger.error('No command specified');
        logger.log('Usage:');
        logger.log('  node controller.js post-single <folderPath>');
        logger.log('  node controller.js post-all <uploadFolder>');
        logger.log('  node controller.js test-adspower');
        process.exit(1);
    }

    const command = args[0];

    try {
        switch (command) {
            case 'post-single':
                if (!args[1]) {
                    throw new Error('Folder path required for post-single command');
                }
                await postSingle(args[1]);
                break;

            case 'post-all':
                if (!args[1]) {
                    throw new Error('Upload folder required for post-all command');
                }
                await postAll(args[1]);
                break;

            case 'test-adspower':
                await testAdsPower();
                break;

            default:
                logger.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (error) {
        logger.fail(`Command failed: ${error.message}`, { error: error.stack });
        process.exit(1);
    }
}

// Handle termination signals
process.on('SIGINT', () => {
    logger.log('Received SIGINT. Stopping...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.log('Received SIGTERM. Stopping...');
    process.exit(0);
});

// Run main
main();
