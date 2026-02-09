/**
 * Renderer Process JavaScript
 * Handles GUI interactions and communication with main process
 */

let currentFolder = null;
let videos = [];
let config = {};

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    setupEventListeners();
    setupIPCListeners();
    addLog('Application started');
});

/**
 * Load configuration from main process
 */
async function loadConfig() {
    config = await window.electronAPI.getConfig();

    if (config) {
        document.getElementById('apiKey').value = config.adspowerApiKey || '';
        document.getElementById('profileId').value = config.adspowerProfileId || '';
        document.getElementById('debugMode').checked = config.debugMode || false;
    }
}

/**
 * Setup event listeners for buttons
 */
function setupEventListeners() {
    // Save config
    document.getElementById('saveConfig').addEventListener('click', async () => {
        config.adspowerApiKey = document.getElementById('apiKey').value;
        config.adspowerProfileId = document.getElementById('profileId').value;
        config.debugMode = document.getElementById('debugMode').checked;

        const result = await window.electronAPI.updateConfig(config);

        if (result) {
            addLog('✅ Configuration saved successfully');
            showNotification('Config saved!', 'success');
        } else {
            addLog('❌ Failed to save configuration');
            showNotification('Failed to save config', 'error');
        }
    });

    // Select folder
    document.getElementById('selectFolder').addEventListener('click', async () => {
        const folderPath = await window.electronAPI.selectFolder();

        if (folderPath) {
            currentFolder = folderPath;
            document.getElementById('selectedFolder').textContent = folderPath;
            addLog(`📁 Selected folder: ${folderPath}`);
            await scanFolders();
        }
    });

    // Refresh
    document.getElementById('refresh').addEventListener('click', async () => {
        if (currentFolder) {
            await scanFolders();
        } else {
            showNotification('Please select a folder first', 'warning');
        }
    });

    // Post all unposted
    document.getElementById('postAll').addEventListener('click', async () => {
        const unposted = videos.filter(v => !v.isPosted);

        if (unposted.length === 0) {
            showNotification('No unposted videos found', 'warning');
            return;
        }

        if (!confirm(`Post ${unposted.length} video(s)?`)) {
            return;
        }

        addLog(`🚀 Starting bulk upload for ${unposted.length} videos...`);

        const result = await window.electronAPI.postBulk(unposted);

        if (result.success) {
            addLog(`✅ Bulk upload completed`);
            await scanFolders(); // Refresh table
        } else {
            addLog(`❌ Bulk upload error: ${result.error}`);
        }
    });

    // Stop process
    document.getElementById('stop').addEventListener('click', async () => {
        await window.electronAPI.stopProcess();
        addLog('⚠️ Process stopped by user');
        showNotification('Process stopped', 'warning');
    });
}

/**
 * Setup IPC listeners for status updates and logs
 */
function setupIPCListeners() {
    // Listen for status updates
    window.electronAPI.onStatusUpdate((data) => {
        document.getElementById('currentAction').textContent = data.action || 'Idle';
        document.getElementById('currentFolder').textContent = data.folder || '-';
        addLog(data.message);
    });

    // Listen for log messages
    window.electronAPI.onLogMessage((message) => {
        addLog(message);
    });
}

/**
 * Scan folders for videos
 */
async function scanFolders() {
    addLog('🔍 Scanning folders...');

    const result = await window.electronAPI.scanFolders(currentFolder);

    if (result.success) {
        videos = result.folders;
        renderVideoTable();
        addLog(`✅ Found ${videos.length} video(s)`);
    } else {
        addLog(`❌ Scan error: ${result.error}`);
        showNotification(`Scan error: ${result.error}`, 'error');
    }
}

/**
 * Render video table
 */
function renderVideoTable() {
    const tbody = document.getElementById('videoTableBody');
    tbody.innerHTML = '';

    if (videos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No videos found in this folder.</td></tr>';
        return;
    }

    videos.forEach((video, index) => {
        const row = document.createElement('tr');

        row.innerHTML = `
      <td>${video.folderName}</td>
      <td>${video.videoFile}</td>
      <td class="caption-preview">${video.captionPreview || '(no caption)'}</td>
      <td>
        <span class="status-badge ${video.isPosted ? 'posted' : 'not-posted'}">
          ${video.isPosted ? '✅ Posted' : '⏳ Not Posted'}
        </span>
      </td>
      <td class="actions">
        <button class="btn btn-sm btn-primary" onclick="postSingleVideo(${index})" ${video.isPosted ? 'disabled' : ''}>
          Post
        </button>
        <button class="btn btn-sm btn-secondary" onclick="openVideoFolder(${index})">
          Open Folder
        </button>
      </td>
    `;

        tbody.appendChild(row);
    });
}

/**
 * Post a single video
 */
async function postSingleVideo(index) {
    const video = videos[index];

    if (!confirm(`Post video from "${video.folderName}"?`)) {
        return;
    }

    addLog(`🚀 Starting upload for: ${video.folderName}`);

    const result = await window.electronAPI.postVideo(video);

    if (result.success) {
        addLog(`✅ Successfully posted: ${video.folderName}`);
        showNotification('Video posted successfully!', 'success');
        await scanFolders(); // Refresh table
    } else {
        addLog(`❌ Failed to post: ${result.error}`);
        showNotification(`Post failed: ${result.error}`, 'error');
    }
}

/**
 * Open video folder in file explorer
 */
async function openVideoFolder(index) {
    const video = videos[index];
    await window.electronAPI.openFolder(video.folderPath);
}

/**
 * Add log message to console
 */
function addLog(message) {
    const logsConsole = document.getElementById('logsConsole');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `[${timestamp}] ${message}`;
    logsConsole.appendChild(logEntry);

    // Auto-scroll to bottom
    logsConsole.scrollTop = logsConsole.scrollHeight;

    // Limit to last 100 messages
    while (logsConsole.children.length > 100) {
        logsConsole.removeChild(logsConsole.firstChild);
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Simple alert for now - can be enhanced with a custom notification system
    addLog(`[${type.toUpperCase()}] ${message}`);
}

// Make functions globally available for onclick handlers
window.postSingleVideo = postSingleVideo;
window.openVideoFolder = openVideoFolder;
