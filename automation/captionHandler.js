/**
 * Caption Handler for Meta Business Suite
 * Handles React-controlled caption inputs with proper state updates
 */

const logger = require('../utils/logger');

/**
 * Find the correct caption textbox on the page
 * Tries multiple strategies to avoid selecting the wrong textbox
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<ElementHandle|null>} Caption textbox element or null
 */
async function findCaptionTextbox(page) {
    try {
        logger.log('[CAPTION] Searching for caption textbox...');

        // Strategy 1: Find textbox with caption-related aria-label or placeholder
        logger.log('[CAPTION] Strategy 1: Looking for textbox with caption-related attributes...');
        const captionBox1 = await page.evaluateHandle(() => {
            const textboxes = Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"]'));

            // Look for textbox with caption-related hints
            for (const box of textboxes) {
                const ariaLabel = (box.getAttribute('aria-label') || '').toLowerCase();
                const placeholder = (box.getAttribute('placeholder') || '').toLowerCase();
                const dataText = (box.getAttribute('data-text') || '').toLowerCase();

                if (ariaLabel.includes('caption') ||
                    placeholder.includes('caption') ||
                    dataText.includes('caption') ||
                    ariaLabel.includes('write') ||
                    placeholder.includes('write')) {
                    return box;
                }
            }

            // Look for textbox near "Caption" label
            const labels = Array.from(document.querySelectorAll('label, span, div'));
            for (const label of labels) {
                const text = (label.textContent || '').trim();
                if (text === 'Caption' || text.includes('Add a caption') || text.includes('Write a caption')) {
                    // Find nearest textbox
                    let parent = label.parentElement;
                    for (let i = 0; i < 5 && parent; i++) {
                        const nearbyBox = parent.querySelector('div[role="textbox"][contenteditable="true"]');
                        if (nearbyBox) return nearbyBox;
                        parent = parent.parentElement;
                    }
                }
            }

            return null;
        });

        if (captionBox1 && (await captionBox1.asElement())) {
            logger.success('[CAPTION] Found caption textbox (Strategy 1: attribute/label match)');
            return captionBox1.asElement();
        }

        // Strategy 2: Find the specific selector known to work for Meta reels
        logger.log('[CAPTION] Strategy 2: Using known Meta reels selector...');
        try {
            const captionBox2 = await page.$('div._5rpu[contenteditable="true"][role="textbox"]');
            if (captionBox2) {
                logger.success('[CAPTION] Found caption textbox (Strategy 2: known selector)');
                return captionBox2;
            }
        } catch (e) {
            logger.warn(`[CAPTION] Strategy 2 failed: ${e.message}`);
        }

        // Strategy 3: Find the largest contenteditable textbox (caption is usually large)
        logger.log('[CAPTION] Strategy 3: Finding largest contenteditable textbox...');
        const captionBox3 = await page.evaluateHandle(() => {
            const textboxes = Array.from(document.querySelectorAll('div[contenteditable="true"]'));

            if (textboxes.length === 0) return null;
            if (textboxes.length === 1) return textboxes[0];

            // Find the one with largest height (caption box is usually taller)
            let largest = textboxes[0];
            let maxHeight = 0;

            for (const box of textboxes) {
                const rect = box.getBoundingClientRect();
                if (rect.height > maxHeight) {
                    maxHeight = rect.height;
                    largest = box;
                }
            }

            return largest;
        });

        if (captionBox3 && (await captionBox3.asElement())) {
            logger.success('[CAPTION] Found caption textbox (Strategy 3: largest textbox)');
            return captionBox3.asElement();
        }

        // Strategy 4: Fallback to any contenteditable div
        logger.log('[CAPTION] Strategy 4: Fallback to any contenteditable...');
        const captionBox4 = await page.$('div[contenteditable="true"]');
        if (captionBox4) {
            logger.success('[CAPTION] Found caption textbox (Strategy 4: fallback)');
            return captionBox4;
        }

        logger.error('[CAPTION] Could not find caption textbox with any strategy');
        return null;

    } catch (error) {
        logger.error(`[CAPTION] Error finding caption textbox: ${error.message}`);
        return null;
    }
}

/**
 * Clear existing caption text from textbox
 * @param {Page} page - Puppeteer page instance
 * @param {ElementHandle} textbox - Caption textbox element
 */
async function clearCaption(page, textbox) {
    try {
        logger.log('[CAPTION] Clearing existing caption...');

        // Click textbox to focus
        await textbox.click();
        await page.waitForTimeout(300);

        // Select all text
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.waitForTimeout(200);

        // Delete selected text
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);

        // Verify it's empty
        const isEmpty = await page.evaluate((el) => {
            const text = el.innerText || el.textContent || '';
            return text.trim().length === 0;
        }, textbox);

        if (isEmpty) {
            logger.success('[CAPTION] Caption cleared successfully');
        } else {
            logger.warn('[CAPTION] Caption may not be fully cleared');
        }

    } catch (error) {
        logger.error(`[CAPTION] Error clearing caption: ${error.message}`);
        throw error;
    }
}

/**
 * Insert caption text with proper React event triggering
 * @param {Page} page - Puppeteer page instance
 * @param {ElementHandle} textbox - Caption textbox element
 * @param {string} captionText - Caption to insert
 */
async function insertCaptionText(page, textbox, captionText) {
    try {
        logger.log('[CAPTION] Inserting caption text...');

        // Focus the textbox
        await textbox.click();
        await page.waitForTimeout(500);

        // Type caption character by character (triggers React properly)
        logger.log('[CAPTION] Typing caption character by character...');
        await textbox.type(captionText, { delay: 50 }); // 50ms delay between keystrokes
        await page.waitForTimeout(500);

        // Trigger React state update with space + backspace trick
        logger.log('[CAPTION] Triggering React state update...');
        await page.keyboard.press('Space');
        await page.waitForTimeout(100);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);

        // Dispatch React events to ensure state is updated
        await page.evaluate((el, text) => {
            // Fire input event
            el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

            // Fire change event
            el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

            // Fire keyup event
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true }));

            // Fire blur event
            el.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));

            // Also try setting the value via data attribute for React
            if (el.hasAttribute('data-text')) {
                el.setAttribute('data-text', text);
            }
        }, textbox, captionText);

        await page.waitForTimeout(500);

        // Click outside to blur (forces React state commit)
        logger.log('[CAPTION] Blurring textbox by clicking outside...');
        await page.evaluate(() => {
            // Click on body or a neutral area
            const body = document.querySelector('body');
            if (body) {
                body.click();
            }
        });
        await page.waitForTimeout(500);

        logger.success('[CAPTION] Caption text inserted with React events');

    } catch (error) {
        logger.error(`[CAPTION] Error inserting caption: ${error.message}`);
        throw error;
    }
}

/**
 * Verify caption was properly set
 * @param {Page} page - Puppeteer page instance
 * @param {string} expectedText - Expected caption text
 * @returns {Promise<boolean>} True if caption matches expected text
 */
async function verifyCaption(page, expectedText) {
    try {
        logger.log('[CAPTION] Verifying caption was set correctly...');

        const actualText = await page.evaluate(() => {
            // Try multiple selectors to read caption
            const selectors = [
                'div._5rpu[contenteditable="true"][role="textbox"]',
                'div[role="textbox"][contenteditable="true"]',
                'div[contenteditable="true"]',
                'textarea'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    const text = el.innerText || el.textContent || el.value || '';
                    if (text.trim().length > 0) {
                        return text.trim();
                    }
                }
            }

            return '';
        });

        const expectedTrimmed = expectedText.trim();
        const actualTrimmed = actualText.trim();

        if (actualTrimmed === expectedTrimmed) {
            logger.success(`[CAPTION] ✅ Caption verified: "${actualTrimmed.substring(0, 50)}${actualTrimmed.length > 50 ? '...' : ''}"`);
            return true;
        } else {
            logger.warn(`[CAPTION] ⚠️ Caption mismatch!`);
            logger.warn(`[CAPTION]   Expected: "${expectedTrimmed.substring(0, 50)}${expectedTrimmed.length > 50 ? '...' : ''}"`);
            logger.warn(`[CAPTION]   Actual: "${actualTrimmed.substring(0, 50)}${actualTrimmed.length > 50 ? '...' : ''}"`);
            return false;
        }

    } catch (error) {
        logger.error(`[CAPTION] Error verifying caption: ${error.message}`);
        return false;
    }
}

/**
 * Set caption with proper React state updates
 * @param {Page} page - Puppeteer page instance
 * @param {string} captionText - Caption to insert
 */
async function setCaption(page, captionText) {
    try {
        logger.log('[CAPTION] Setting caption...');

        // Find caption textbox
        const textbox = await findCaptionTextbox(page);
        if (!textbox) {
            throw new Error('Caption textbox not found');
        }

        // Clear existing caption
        await clearCaption(page, textbox);

        // Insert caption text
        await insertCaptionText(page, textbox, captionText);

        logger.success('[CAPTION] Caption set successfully');

    } catch (error) {
        logger.error(`[CAPTION] Failed to set caption: ${error.message}`);
        throw error;
    }
}

/**
 * Apply caption with retry logic
 * @param {Page} page - Puppeteer page instance
 * @param {string} captionText - Caption to insert
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 */
async function applyCaptionWithRetry(page, captionText, maxRetries = 3) {
    try {
        logger.log(`[CAPTION] Applying caption with retry (max ${maxRetries} attempts)...`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            logger.log(`[CAPTION] Attempt ${attempt}/${maxRetries}...`);

            try {
                // Set caption
                await setCaption(page, captionText);

                // Wait before verification
                await page.waitForTimeout(1000);

                // Verify caption
                const verified = await verifyCaption(page, captionText);

                if (verified) {
                    logger.success(`[CAPTION] ✅ Caption successfully applied and verified on attempt ${attempt}`);

                    // Wait additional time to ensure React state is committed
                    logger.log('[CAPTION] Waiting 2 seconds for React state to stabilize...');
                    await page.waitForTimeout(2000);

                    return true;
                }

                // If not verified and not last attempt, retry
                if (attempt < maxRetries) {
                    logger.warn(`[CAPTION] ⚠️ Caption not verified, retrying in 1 second...`);
                    await page.waitForTimeout(1000);
                } else {
                    logger.error('[CAPTION] ❌ Caption verification failed after all retries');

                    // Take debug screenshot
                    const screenshotPath = `./debug_caption_failed_${Date.now()}.png`;
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    logger.error(`[CAPTION] Debug screenshot saved: ${screenshotPath}`);

                    throw new Error('Caption verification failed after all retry attempts');
                }

            } catch (attemptError) {
                logger.error(`[CAPTION] Attempt ${attempt} failed: ${attemptError.message}`);

                if (attempt === maxRetries) {
                    throw attemptError;
                }

                await page.waitForTimeout(1000);
            }
        }

    } catch (error) {
        logger.error(`[CAPTION] Failed to apply caption with retry: ${error.message}`);
        throw error;
    }
}

module.exports = {
    findCaptionTextbox,
    clearCaption,
    insertCaptionText,
    verifyCaption,
    setCaption,
    applyCaptionWithRetry
};
