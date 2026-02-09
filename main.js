/**
 * Electron Main Process
 * Entry point for the Electron application
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const { scanFolders } = require('./utils/folderScanner');
const MetaReelsUploader = require('./automation/uploader');
const logger = require('./utils/logger');

let mainWindow;
let uploader;
let config;
let isProcessing = false;

/**
 * Load configuration from config.json
 */
function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configData);
        logger.log('Configuration loaded successfully');
        return config;
    } catch (error) {
        logger.error(`Failed to load config: ${error.message}`);
        return null;
    }
}

/**
 * Save configuration to config.json
 */
function saveConfig(newConfig) {
    try {
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
        config = newConfig;
        logger.success('Configuration saved successfully');
        return true;
    } catch (error) {
        logger.error(`Failed to save config: ${error.message}`);
        return false;
    }
}

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
    loadConfig();
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
    return saveConfig(newConfig);
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
        const folders = scanFolders(rootPath);
        logger.success(`Found ${folders.length} video folders`);
        return { success: true, folders };
    } catch (error) {
        logger.error(`Scan error: ${error.message}`);
        return { success: false, error: error.message };
    }
});

/**
 * Post single video
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

        // Create uploader instance
        uploader = new MetaReelsUploader(config);

        // Upload video
        await uploader.uploadVideo(videoData);

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
 * Post multiple videos (bulk mode)
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
                uploader = new MetaReelsUploader(config);
                await uploader.uploadVideo(videoData);
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
    const { shell } = require('electron');
    shell.openPath(folderPath);
    return { success: true };
});

// Forward logger output to renderer
const originalLog = console.log;
console.log = (...args) => {
    originalLog(...args);
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('log-message', args.join(' '));
    }
};
