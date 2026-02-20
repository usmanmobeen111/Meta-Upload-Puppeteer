/**
 * Debug Capture Utility
 * Captures screenshots, HTML, and text at each automation step
 * Uses Electron userData directory for debug storage
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Get debug directory path in userData
 * @returns {string} Full path to debug directory
 */
function getDebugPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'debug');
}

/**
 * Ensure debug directories exist
 * Creates directories lazily when needed
 */
function ensureDebugDirectories() {
    const debugDir = getDebugPath();
    const screenshotsDir = path.join(debugDir, 'screenshots');
    const htmlDir = path.join(debugDir, 'html');
    const textDir = path.join(debugDir, 'text');
    const errorsDir = path.join(debugDir, 'errors');

    [debugDir, screenshotsDir, htmlDir, textDir, errorsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    return { debugDir, screenshotsDir, htmlDir, textDir, errorsDir };
}

/**
 * Get formatted timestamp for filenames
 * @returns {string} Timestamp in YYYY-MM-DD_HH-MM-SS format
 */
function getFileTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Sanitize folder name for use in filenames
 * @param {string} folderName
 * @returns {string} Sanitized name
 */
function sanitizeFolderName(folderName) {
    return folderName.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Capture debug information at a specific step
 * @param {Object} page - Puppeteer page object
 * @param {string} folderName - Current folder being processed
 * @param {string} stepName - Name of the current step
 * @param {Object} config - Configuration object with debugMode flag
 */
async function debugCapture(page, folderName, stepName, config) {
    // Only capture if debug mode is enabled
    if (!config || !config.debugMode) {
        return;
    }

    try {
        // Ensure directories exist before capturing
        const { screenshotsDir, htmlDir, textDir } = ensureDebugDirectories();
        
        const timestamp = getFileTimestamp();
        const sanitizedFolder = sanitizeFolderName(folderName);
        const baseFilename = `${timestamp}_${sanitizedFolder}_${stepName}`;

        // Capture screenshot
        const screenshotPath = path.join(screenshotsDir, `${baseFilename}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Capture HTML
        const html = await page.content();
        const htmlPath = path.join(htmlDir, `${baseFilename}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');

        // Capture visible text
        const text = await page.evaluate(() => document.body.innerText);
        const textPath = path.join(textDir, `${baseFilename}.txt`);
        fs.writeFileSync(textPath, text, 'utf8');

        console.log(`📸 Debug capture complete: ${stepName}`);
    } catch (error) {
        console.error(`⚠️  Debug capture failed: ${error.message}`);
    }
}

/**
 * Capture error evidence when a step fails
 * @param {Object} page - Puppeteer page object
 * @param {string} folderName - Current folder being processed
 * @param {string} stepName - Name of the failed step
 * @param {Error} error - Error object
 */
async function captureErrorEvidence(page, folderName, stepName, error) {
    try {
        // Ensure directories exist before capturing
        const { errorsDir } = ensureDebugDirectories();
        
        const timestamp = getFileTimestamp();
        const sanitizedFolder = sanitizeFolderName(folderName);
        const baseFilename = `${timestamp}_${sanitizedFolder}_${stepName}_ERROR`;

        // Capture screenshot
        const screenshotPath = path.join(errorsDir, `${baseFilename}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Capture HTML
        const html = await page.content();
        const htmlPath = path.join(errorsDir, `${baseFilename}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');

        // Capture visible text
        const text = await page.evaluate(() => document.body.innerText);
        const textPath = path.join(errorsDir, `${baseFilename}.txt`);
        fs.writeFileSync(textPath, text, 'utf8');

        // Capture error details
        const errorData = {
            folderName: folderName,
            stepName: stepName,
            error: error.message,
            stackTrace: error.stack,
            timestamp: new Date().toISOString()
        };
        const errorPath = path.join(errorsDir, `${baseFilename}.json`);
        fs.writeFileSync(errorPath, JSON.stringify(errorData, null, 2), 'utf8');

        console.log(`🔴 Error evidence captured: ${stepName}`);
    } catch (captureError) {
        console.error(`⚠️  Failed to capture error evidence: ${captureError.message}`);
    }
}

module.exports = {
    debugCapture,
    captureErrorEvidence,
    getDebugPath
};
