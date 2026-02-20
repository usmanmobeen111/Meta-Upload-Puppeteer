/**
 * Configuration Manager
 * Handles configuration file management using Electron's userData directory
 * Ensures config is stored in a writable location when app is installed
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Get the config file path in userData directory
 * @returns {string} Full path to config.json
 */
function getConfigPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'config.json');
}

/**
 * Get default configuration values
 * @returns {Object} Default config object
 */
function getDefaultConfig() {
    return {
        adspowerApiKey: '',
        adspowerProfileId: '',
        facebookPageId: '',
        uploadFolderPath: '',
        debugMode: true,
        maxRetries: 3,
        uploadTimeoutSeconds: 300
    };
}

/**
 * Load configuration from userData
 * Creates default config if file doesn't exist
 * @returns {Object} Configuration object
 */
function loadConfig() {
    try {
        const configPath = getConfigPath();

        // Create config file with defaults if it doesn't exist
        if (!fs.existsSync(configPath)) {
            console.log('[CONFIG] Config file not found, creating default config...');
            const defaultConfig = getDefaultConfig();
            saveConfig(defaultConfig);
            return defaultConfig;
        }

        // Read and parse existing config
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        console.log(`[CONFIG] Configuration loaded from: ${configPath}`);
        return config;
    } catch (error) {
        console.error(`[CONFIG] Error loading config: ${error.message}`);
        console.log('[CONFIG] Returning default config...');
        return getDefaultConfig();
    }
}

/**
 * Save configuration to userData
 * @param {Object} config - Configuration object to save
 * @returns {boolean} Success status
 */
function saveConfig(config) {
    try {
        const configPath = getConfigPath();
        const userDataPath = path.dirname(configPath);

        // Ensure userData directory exists
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }

        // Write config file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log(`[CONFIG] Configuration saved to: ${configPath}`);
        return true;
    } catch (error) {
        console.error(`[CONFIG] Error saving config: ${error.message}`);
        return false;
    }
}

module.exports = {
    getConfigPath,
    loadConfig,
    saveConfig,
    getDefaultConfig
};
