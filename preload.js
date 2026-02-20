/**
 * Electron Preload Script
 * Exposes safe APIs to renderer process via context bridge
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Get configuration
    getConfig: () => ipcRenderer.invoke('get-config'),

    // Update configuration
    updateConfig: (config) => ipcRenderer.invoke('update-config', config),

    // Select folder
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // Scan folders
    scanFolders: (rootPath) => ipcRenderer.invoke('scan-folders', rootPath),

    // Post single video
    postVideo: (videoData) => ipcRenderer.invoke('post-video', videoData),

    // Post multiple videos
    postBulk: (videosArray) => ipcRenderer.invoke('post-bulk', videosArray),

    // Stop current process
    stopProcess: () => ipcRenderer.invoke('stop-process'),

    // Open folder in explorer
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

    // Open app data folder (userData)
    openAppDataFolder: () => ipcRenderer.invoke('open-app-data-folder'),

    // Listen for status updates
    onStatusUpdate: (callback) => {
        ipcRenderer.on('status-update', (event, data) => callback(data));
    },

    // Listen for log messages
    onLogMessage: (callback) => {
        ipcRenderer.on('log-message', (event, message) => callback(message));
    }
});
