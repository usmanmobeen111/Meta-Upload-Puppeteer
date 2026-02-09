const fs = require('fs');

const htmlPath = 'c:/Users/usman/Desktop/Meta Upload Puppeteer/debug/html/2026-02-09_14-35-41_Video_1_STEP_9_CLICK_SHARE.html';
const html = fs.readFileSync(htmlPath, 'utf8');

// Find all button-like elements containing "Share" text
const buttonRegex = /\u003cdiv[^>]*role="button"[^>]*>[^<]*Share[^<]*\u003c\/div>/gi;
const matches = html.match(buttonRegex);

if (matches) {
    console.log(`Found ${matches.length} button with"Share" text\n`);
    matches.forEach((match, i) => {
        console.log(`\n=== Match ${i + 1} ===`);
        console.log(match);
    });
} else {
    console.log('No button elements with "Share" text found.');

    // Try finding any div with "Share"
    console.log('\nSearching for divs with Share text...');
    const divRegex = /\u003cdiv[^>]{0,500}>Share\u003c\/div>/gi;
    const divMatches = html.match(divRegex);

    if (divMatches) {
        console.log(`\nFound ${divMatches.length} divs with "Share" text`);
        divMatches.slice(0, 3).forEach((match, i) => {
            console.log(`\n=== Div Match ${i + 1} ===`);
            console.log(match);
        });
    }
}
