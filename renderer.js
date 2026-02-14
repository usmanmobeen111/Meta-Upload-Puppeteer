/**
 * Renderer Process - Enhanced UI Controller
 * Handles all frontend interactions, progress tracking, and log streaming
 */

let currentFolder = null;
let videos = [];
let config = {};

// State Management
const state = {
  currentSection: 'settings',
  isProcessing: false,
  currentVideo: null,
  currentStep: null,
  progress: 0
};

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  setupNavigation();
  setupEventListeners();
  setupIPCListeners();
  addLog('info', 'Application initialized successfully');
});

/**
 * Load configuration from main process
 */
async function loadConfig() {
  try {
    config = await window.electronAPI.getConfig();

    if (config) {
      document.getElementById('apiKey').value = config.adspowerApiKey || '';
      document.getElementById('profileId').value = config.adspowerProfileId || '';
      document.getElementById('pageId').value = config.facebookPageId || '';
      document.getElementById('uploadFolder').value = config.uploadFolderPath || '';
      document.getElementById('debugMode').checked = config.debugMode || false;
    }
  } catch (error) {
    addLog('error', `Failed to load config: ${error.message}`);
  }
}

/**
 * Setup sidebar navigation
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;

      // Update nav active state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update content sections
      document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
      });
      document.getElementById(section).classList.add('active');

      state.currentSection = section;
    });
  });
}

/**
 * Setup event listeners for all interactive elements
 */
function setupEventListeners() {
  // Save Config
  document.getElementById('saveConfig').addEventListener('click', async () => {
    const newConfig = {
      ...config,
      adspowerApiKey: document.getElementById('apiKey').value,
      adspowerProfileId: document.getElementById('profileId').value,
      facebookPageId: document.getElementById('pageId').value,
      uploadFolderPath: document.getElementById('uploadFolder').value,
      debugMode: document.getElementById('debugMode').checked
    };

    const result = await window.electronAPI.updateConfig(newConfig);

    if (result) {
      config = newConfig;
      addLog('success', 'Configuration saved successfully');
      showNotification('Config saved!', 'success');
    } else {
      addLog('error', 'Failed to save configuration');
      showNotification('Failed to save config', 'error');
    }
  });

  // Select Folder
  document.getElementById('selectFolder').addEventListener('click', async () => {
    const folderPath = await window.electronAPI.selectFolder();

    if (folderPath) {
      document.getElementById('uploadFolder').value = folderPath;
      currentFolder = folderPath;
      addLog('info', `Selected upload folder: ${folderPath}`);
    }
  });

  // Test AdsPower Connection
  document.getElementById('testConnection').addEventListener('click', async () => {
    addLog('info', 'Testing AdsPower connection...');
    // This could be implemented to test the connection
    showNotification('Test connection feature coming soon!', 'info');
  });

  // Scan Folder
  document.getElementById('scanFolder').addEventListener('click', async () => {
    if (!currentFolder) {
      const folderPath = document.getElementById('uploadFolder').value;
      if (folderPath) {
        currentFolder = folderPath;
      } else {
        showNotification('Please select a folder first', 'warning');
        return;
      }
    }

    await scanFolders();
  });

  // Post All Unposted
  document.getElementById('postAll').addEventListener('click', async () => {
    const unposted = videos.filter(v => !v.isPosted);

    if (unposted.length === 0) {
      showNotification('No unposted videos found', 'warning');
      return;
    }

    if (!confirm(`Post ${unposted.length} video(s)?`)) {
      return;
    }

    addLog('info', `Starting bulk upload for ${unposted.length} videos...`);

    const result = await window.electronAPI.postBulk(unposted);

    if (result.success) {
      addLog('success', `Bulk upload completed: ${result.results.filter(r => r.success).length}/${result.results.length} successful`);
      await scanFolders(); // Refresh table
    } else {
      addLog('error', `Bulk upload error: ${result.error}`);
    }
  });

  // Stop Process
  document.getElementById('stopProcess').addEventListener('click', async () => {
    await window.electronAPI.stopProcess();
    addLog('warn', 'Process stop requested by user');
    showNotification('Process stopped', 'warning');
    hideProgress();
  });

  // Open Debug Folder
  document.getElementById('openDebugFolder').addEventListener('click', async () => {
    const debugPath = config.debugFolderPath || 'debug';
    await window.electronAPI.openFolder(debugPath);
    addLog('info', 'Opened debug folder');
  });

  // Clear Logs
  document.getElementById('clearLogs').addEventListener('click', () => {
    document.getElementById('logsContainer').innerHTML = '';
    addLog('info', 'Logs cleared');
  });
}

/**
 * Setup IPC listeners for status updates, logs, and progress
 */
function setupIPCListeners() {
  // Listen for status updates
  window.electronAPI.onStatusUpdate((data) => {
    if (data.action) {
      addLog('step', data.message || data.action);
    }

    if (data.folder) {
      updateProgress({
        currentVideo: data.folder,
        currentStep: data.action
      });
    }
  });

  // Listen for log messages
  window.electronAPI.onLogMessage((message) => {
    // Parse log level from message
    let level = 'info';
    if (message.includes('✅') || message.toLowerCase().includes('success')) {
      level = 'success';
    } else if (message.includes('❌') || message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
      level = 'error';
    } else if (message.includes('⚠️') || message.toLowerCase().includes('warn')) {
      level = 'warn';
    } else if (message.toLowerCase().includes('step')) {
      level = 'step';
    }

    addLog(level, message);
  });

  // Listen for progress updates (if implemented)
  if (window.electronAPI.onProgressUpdate) {
    window.electronAPI.onProgressUpdate((data) => {
      updateProgress(data);
    });
  }
}

/**
 * Scan folders for videos
 */
async function scanFolders() {
  addLog('info', 'Scanning upload folder...');

  try {
    const result = await window.electronAPI.scanFolders(currentFolder);

    if (result.success) {
      videos = result.folders;
      renderVideoTable();
      addLog('success', `Found ${videos.length} video folder(s)`);

      // Switch to upload section if not there
      if (state.currentSection !== 'upload') {
        document.querySelector('.nav-item[data-section="upload"]').click();
      }
    } else {
      addLog('error', `Scan error: ${result.error}`);
      showNotification(`Scan error: ${result.error}`, 'error');
    }
  } catch (error) {
    addLog('error', `Scan failed: ${error.message}`);
  }
}

/**
 * Render video table
 */
function renderVideoTable() {
  const tbody = document.getElementById('videoTableBody');
  tbody.innerHTML = '';

  if (videos.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-state">
        <td colspan="5">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path>
          </svg>
          <p>No videos found in this folder.</p>
        </td>
      </tr>
    `;
    return;
  }

  videos.forEach((video, index) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${escapeHtml(video.folderName)}</td>
      <td>${escapeHtml(video.videoFile)}</td>
      <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(video.captionPreview || '(no caption)')}</td>
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
          Open
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

  if (!confirm(`Post reel from "${video.folderName}"?`)) {
    return;
  }

  addLog('info', `Starting upload for: ${video.folderName}`);
  showProgress();
  updateProgress({
    currentVideo: video.folderName,
    currentStep: 'Initializing...',
    percentage: 0
  });

  const result = await window.electronAPI.postVideo(video);

  if (result.success) {
    addLog('success', `Successfully posted: ${video.folderName}`);
    showNotification('Video posted successfully!', 'success');
    hideProgress();
    await scanFolders(); // Refresh table
  } else {
    addLog('error', `Failed to post: ${result.error}`);
    showNotification(`Post failed: ${result.error}`, 'error');
    hideProgress();
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
 * Show progress card
 */
function showProgress() {
  document.getElementById('progressCard').style.display = 'block';
  state.isProcessing = true;
}

/**
 * Hide progress card
 */
function hideProgress() {
  document.getElementById('progressCard').style.display = 'none';
  state.isProcessing = false;
  updateProgress({
    currentVideo: '-',
    currentStep: '-',
    percentage: 0
  });
}

/**
 * Update progress display
 * @param {Object} data - { currentVideo, currentStep, percentage }
 */
function updateProgress(data) {
  if (data.currentVideo) {
    document.getElementById('currentVideo').textContent = data.currentVideo;
    state.currentVideo = data.currentVideo;
  }

  if (data.currentStep) {
    document.getElementById('currentStep').textContent = data.currentStep;
    state.currentStep = data.currentStep;
  }

  if (typeof data.percentage === 'number') {
    const percentage = Math.min(100, Math.max(0, data.percentage));
    document.getElementById('progressBar').style.width = `${percentage}%`;
    document.getElementById('progressPercent').textContent = `${Math.round(percentage)}%`;
    state.progress = percentage;
  }
}

/**
 * Add log message to terminal
 * @param {string} level - info|success|error|warn|step
 * @param {string} message - Log message
 */
function addLog(level, message) {
  const logsContainer = document.getElementById('logsContainer');
  const timestamp = new Date().toLocaleTimeString();

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';

  logEntry.innerHTML = `
    <span class="log-timestamp">${timestamp}</span>
    <span class="log-level ${level}">${level}</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;

  logsContainer.appendChild(logEntry);

  // Auto-scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;

  // Limit to last 500 messages
  while (logsContainer.children.length > 500) {
    logsContainer.removeChild(logsContainer.firstChild);
  }
}

/**
 * Show notification banner (simple implementation)
 */
function showNotification(message, type = 'info') {
  // For now, just log it
  addLog(type, `[NOTIFICATION] ${message}`);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally available for onclick handlers
window.postSingleVideo = postSingleVideo;
window.openVideoFolder = openVideoFolder;
