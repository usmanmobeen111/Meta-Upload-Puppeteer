/**
 * Centralized Logging Utility
 * Logs to console and file simultaneously
 * Uses Electron userData directory for log storage
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Get logs directory path in userData
 * @returns {string} Full path to logs directory
 */
function getLogsPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'logs');
}

// Ensure logs directory exists
const logsDir = getLogsPath();
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create timestamped log file
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const logFilePath = path.join(logsDir, `app_${timestamp}.log`);

/**
 * Format timestamp for log entries
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
 * Write log entry to file and console
 * @param {string} level - Log level (INFO, WARN, ERROR, SUCCESS)
 * @param {string} message - Log message
 */
function writeLog(level, message) {
    const timestamp = getTimestamp();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    // Write to file
    fs.appendFileSync(logFilePath, logEntry, 'utf8');

    // Write to console with color
    const colors = {
        INFO: '\x1b[36m',    // Cyan
        WARN: '\x1b[33m',    // Yellow
        ERROR: '\x1b[31m',   // Red
        SUCCESS: '\x1b[32m', // Green
        RESET: '\x1b[0m'
    };

    const color = colors[level] || colors.RESET;
    console.log(`${color}[${timestamp}] [${level}]${colors.RESET} ${message}`);
}

/**
 * Log info message
 * @param {string} message
 */
function log(message) {
    writeLog('INFO', message);
}

/**
 * Log warning message
 * @param {string} message
 */
function warn(message) {
    writeLog('WARN', message);
}

/**
 * Log error message
 * @param {string} message
 */
function error(message) {
    writeLog('ERROR', message);
}

/**
 * Log success message
 * @param {string} message
 */
function success(message) {
    writeLog('SUCCESS', message);
}

/**
 * Log workflow step
 * @param {string} message
 */
function step(message) {
    const timestamp = getTimestamp();
    const logEntry = `[${timestamp}] [STEP] ${message}\n`;

    // Write to file
    fs.appendFileSync(logFilePath, logEntry, 'utf8');

    // Write to console with magenta color
    console.log(`\x1b[35m[${timestamp}] [STEP]\x1b[0m ${message}`);
}

module.exports = {
    log,
    warn,
    error,
    success,
    step,
    getLogFilePath: () => logFilePath,
    getLogsPath
};
