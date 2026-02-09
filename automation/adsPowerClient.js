/**
 * AdsPower Local API Client
 * Handles communication with AdsPower browser profiles
 */

const axios = require('axios');
const logger = require('../utils/logger');

class AdsPowerClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'http://localhost:50325'; // Default AdsPower API endpoint
    }

    /**
     * Start an AdsPower profile
     * @param {string} profileId - AdsPower profile ID
     * @returns {Promise<Object>} Profile session data with WebSocket endpoint
     */
    async startProfile(profileId) {
        try {
            logger.log(`Starting AdsPower profile: ${profileId}`);

            const response = await axios.get(`${this.baseUrl}/api/v1/browser/start`, {
                params: {
                    user_id: profileId,
                    apikey: this.apiKey
                }
            });

            if (response.data.code !== 0) {
                throw new Error(`AdsPower API error: ${response.data.msg}`);
            }

            const { ws, debug_port, webdriver } = response.data.data;

            logger.success(`AdsPower profile started successfully`);

            // Log all available connection methods for debugging
            logger.log(`WebSocket endpoints available:`);
            if (ws && ws.selenium) logger.log(`  - Selenium: ${ws.selenium}`);
            if (ws && ws.puppeteer) logger.log(`  - Puppeteer: ${ws.puppeteer}`);
            if (debug_port) logger.log(`  - Debug Port: ${debug_port}`);

            // Puppeteer endpoint first (if available), then Selenium, then debug port
            let wsEndpoint = null;
            if (ws && ws.puppeteer) {
                wsEndpoint = ws.puppeteer;
                logger.log(`Using Puppeteer WebSocket endpoint`);
            } else if (ws && ws.selenium) {
                wsEndpoint = ws.selenium;
                logger.log(`Using Selenium WebSocket endpoint`);
            }

            return {
                wsEndpoint: wsEndpoint,
                debugPort: debug_port,
                webdriver: webdriver
            };
        } catch (error) {
            logger.error(`Failed to start AdsPower profile: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stop an AdsPower profile
     * @param {string} profileId - AdsPower profile ID
     * @returns {Promise<boolean>} Success status
     */
    async stopProfile(profileId) {
        try {
            logger.log(`Stopping AdsPower profile: ${profileId}`);

            const response = await axios.get(`${this.baseUrl}/api/v1/browser/stop`, {
                params: {
                    user_id: profileId,
                    apikey: this.apiKey
                }
            });

            if (response.data.code !== 0) {
                throw new Error(`AdsPower API error: ${response.data.msg}`);
            }

            logger.success(`AdsPower profile stopped successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to stop AdsPower profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Check profile status
     * @param {string} profileId - AdsPower profile ID
     * @returns {Promise<Object>} Status information
     */
    async checkStatus(profileId) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/browser/active`, {
                params: {
                    user_id: profileId,
                    apikey: this.apiKey
                }
            });

            return {
                isActive: response.data.code === 0,
                data: response.data.data
            };
        } catch (error) {
            logger.warn(`Failed to check profile status: ${error.message}`);
            return { isActive: false, data: null };
        }
    }
}

module.exports = AdsPowerClient;
