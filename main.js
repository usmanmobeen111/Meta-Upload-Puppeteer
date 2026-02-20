/**
 * Electron Main Process
 * Entry point for the Electron application
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { scanFolders } = require('./utils/folderScanner');
const MetaReelsUploader = require('./automation/uploader');
const MetaPostUploader = require('./automation/postUploader');
const logger = require('./utils/logger');
const configManager = require('./utils/configManager');
const { getDebugPath } = require('./utils/debugCapture');
const { getLogsPath } = require('./utils/logger');

let mainWindow;
let uploader;
let config;
let isProcessing = false;

/**
 * Create main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png')
    });

    mainWindow.loadFile('index.html');

    // Open DevTools in development
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle
app.whenReady().then(() => {
    // Load config from userData
    config = configManager.loadConfig();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC Handlers

/**
 * Get current configuration
 */
ipcMain.handle('get-config', async () => {
    return config;
});

/**
 * Update configuration
 */
ipcMain.handle('update-config', async (event, newConfig) => {
    const success = configManager.saveConfig(newConfig);
    if (success) {
        config = newConfig;
    }
    return success;
});

/**
 * Select root folder
 */
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (result.canceled) {
        return null;
    }

    return result.filePaths[0];
});

/**
 * Scan folders for videos
 */
ipcMain.handle('scan-folders', async (event, rootPath) => {
    try {
        logger.log(`Scanning folders in: ${rootPath}`);
        const folders = await scanFolders(rootPath); // Now async
        logger.success(`Found ${folders.length} video folders`);
        return { success: true, folders };
    } catch (error) {
        logger.error(`Scan error: ${error.message}`);
        return { success: false, error: error.message };
    }
});

/**
 * Post single video (intelligently routes to Reels or Posts workflow)
 */
ipcMain.handle('post-video', async (event, videoData) => {
    if (isProcessing) {
        return { success: false, error: 'Another process is already running' };
    }

    try {
        isProcessing = true;

        // Send status update
        mainWindow.webContents.send('status-update', {
            action: 'Starting upload',
            folder: videoData.folderName,
            message: 'Initializing...'
        });

        // Determine which uploader to use based on contentType
        const contentType = videoData.contentType || 'reels'; // Default to reels if not specified
        
        if (contentType === 'posts') {
            // Use POST uploader
            logger.log(`[ROUTER] Using POST workflow for: ${videoData.folderName}`);
            uploader = new MetaPostUploader(config);
            await uploader.uploadPost(videoData);
        } else {
            // Use REEL uploader (default)
            logger.log(`[ROUTER] Using REEL workflow for: ${videoData.folderName}`);
            uploader = new MetaReelsUploader(config);
            await uploader.uploadVideo(videoData);
        }

        isProcessing = false;

        mainWindow.webContents.send('status-update', {
            action: 'Complete',
            folder: videoData.folderName,
            message: 'Video posted successfully!'
        });

        return { success: true };
    } catch (error) {
        isProcessing = false;
        logger.error(`Upload failed: ${error.message}`);

        mainWindow.webContents.send('status-update', {
            action: 'Error',
            folder: videoData.folderName,
            message: `Error: ${error.message}`
        });

        return { success: false, error: error.message };
    }
});

/**
 * Post multiple videos (bulk mode) - intelligently routes based on contentType
 */
ipcMain.handle('post-bulk', async (event, videosArray) => {
    if (isProcessing) {
        return { success: false, error: 'Another process is already running' };
    }

    try {
        isProcessing = true;
        const results = [];

        for (let i = 0; i < videosArray.length; i++) {
            const videoData = videosArray[i];

            mainWindow.webContents.send('status-update', {
                action: `Uploading ${i + 1} of ${videosArray.length}`,
                folder: videoData.folderName,
                message: 'Processing...'
            });

            try {
                const contentType = videoData.contentType || 'reels';
                
                if (contentType === 'posts') {
                    uploader = new MetaPostUploader(config);
                    await uploader.uploadPost(videoData);
                } else {
                    uploader = new MetaReelsUploader(config);
                    await uploader.uploadVideo(videoData);
                }
                
                results.push({ folderName: videoData.folderName, success: true });
            } catch (error) {
                results.push({
                    folderName: videoData.folderName,
                    success: false,
                    error: error.message
                });
            }
        }

        isProcessing = false;

        mainWindow.webContents.send('status-update', {
            action: 'Bulk upload complete',
            folder: '',
            message: `Completed ${results.filter(r => r.success).length}/${results.length} videos`
        });

        return { success: true, results };
    } catch (error) {
        isProcessing = false;
        return { success: false, error: error.message };
    }
});

/**
 * Stop current process
 */
ipcMain.handle('stop-process', async () => {
    isProcessing = false;
    logger.warn('Process stopped by user');
    return { success: true };
});

/**
 * Open folder in file explorer
 */
ipcMain.handle('open-folder', async (event, folderPath) => {
    let targetPath = folderPath;
    
    // If no path provided or it's "debug", use the debug folder from userData
    if (!folderPath || folderPath === 'debug') {
        targetPath = getDebugPath();
    }
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    
    shell.openPath(targetPath);
    return { success: true };
});

/**
 * Open app data folder (userData directory)
 */
ipcMain.handle('open-app-data-folder', async () => {
    const userDataPath = app.getPath('userData');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    shell.openPath(userDataPath);
    logger.log(`Opened app data folder: ${userDataPath}`);
    return { success: true, path: userDataPath };
});

// Forward logger output to renderer
const originalLog = console.log;
console.log = (...args) => {
    originalLog(...args);
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('log-message', args.join(' '));
    }
};
