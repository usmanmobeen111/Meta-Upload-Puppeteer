/**
 * POST Workflow Selector Configuration
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  USER: PASTE YOUR SELECTORS IN THE MARKED SECTIONS      ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * The postUploader.js nuclear engine works WITHOUT these selectors.
 * These are OPTIONAL overrides for when you have exact selectors
 * from your specific Meta Business Suite profile.
 *
 * Leave a value as null to let the nuclear engine auto-detect.
 */

module.exports = {

    // ============================================================
    // CREATE POST BUTTON
    // ============================================================
    // The button that opens the "Create Post" dialog.
    //
    // Known working selector (some profiles):
    //   '[data-surface="/bizweb:home/lib:biz-kit-home-page-entry"]'
    //
    // USER: Paste your exact selector here, or leave null.
    CREATE_POST_BUTTON: {
        selector: null,   // ← PASTE HERE (e.g. 'div[role="button"][data-surface="..."]')
        text: 'Create post'
    },

    // ============================================================
    // CAPTION TEXTAREA
    // ============================================================
    // The contenteditable div where you type the post caption.
    //
    // Common patterns:
    //   'div[contenteditable="true"][role="combobox"]'
    //   'div[contenteditable="true"][aria-label*="Write"]'
    //   'div[contenteditable="true"][role="textbox"]'
    //
    // USER: Paste your exact selector here, or leave null.
    CAPTION_TEXTAREA: {
        selector: null,   // ← PASTE HERE
        fallbacks: [
            'div[contenteditable="true"][role="combobox"][aria-label*="dialogue"]',
            'div[contenteditable="true"][role="combobox"][aria-label*="Write"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"][role="combobox"]',
            'div[contenteditable="true"]'
        ]
    },

    // ============================================================
    // PUBLISH BUTTON
    // ============================================================
    // The final button to publish the post.
    //
    // Common patterns:
    //   'div[role="button"][aria-label="Publish"]'
    //   '//div[@role="button" and .//div[text()="Publish"]]'
    //
    // USER: Paste your exact selector here, or leave null.
    PUBLISH_BUTTON: {
        selector: null,   // ← PASTE HERE
        text: 'Publish'
    },

    // ============================================================
    // FILE INPUT (fallback only — nuclear engine handles upload)
    // ============================================================
    FILE_INPUT: {
        selectors: [
            'input[type="file"][accept*="video"]',
            'input[type="file"][accept*="mp4"]',
            'input[type="file"]'
        ]
    }
};
