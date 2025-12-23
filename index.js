const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080);

// Function to find Chrome executable
function findChrome() {
    const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        process.env.CHROME_PATH,
    ].filter(Boolean);

    for (const path of paths) {
        if (fs.existsSync(path)) {
            console.log(`Found Chrome at: ${path}`);
            return path;
        }
    }

    throw new Error('Chrome executable not found');
}

// Your Replit Auto-Run Script
const userScript = `
(function() {
    'use strict';
    const CHECK_INTERVAL_MS = 5000; 
    const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
    const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

    const simulateMouseClick = (element) => {
        const dispatchEvent = (type) => {
            const event = new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(event);
        };
        dispatchEvent('mousedown');
        dispatchEvent('mouseup');
        dispatchEvent('click');
    };

    function monitorAndClickRunButton() {
        const button = document.querySelector(BUTTON_SELECTOR);

        if (button) {
            const iconPath = button.querySelector('svg path');

            if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {
                simulateMouseClick(button);
                console.log('Replit Auto-Run: Found RUN icon (Play). Restarting service.');
            } else {
                console.log('Replit Auto-Run: Button found, but icon is NOT the RUN (Play) triangle. App is running or stopping.');
            }
        } else {
            console.log('Replit Auto-Run: Button component not found. Retrying in 5 seconds.');
        }
    }

    console.log('Replit Auto-Run: Starting state-aware monitor. Checking every 5 seconds.');
    setInterval(monitorAndClickRunButton, CHECK_INTERVAL_MS);
})();
`;

async function startBrowser() {
    console.log("Starting browser with Auto-Run script...");
    try {
        const chromePath = findChrome();

        const userDataDir = path.join(__dirname, 'chrome_user_data');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        const cookiesPath = path.join(__dirname, 'replit_cookies.json');

        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote'
            ]
        });

        console.log("✓ Browser launched!");

        const page = await browser.newPage();

        // Inject the userscript on every page load
        await page.evaluateOnNewDocument(userScript);

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Load saved cookies if they exist
        if (fs.existsSync(cookiesPath)) {
            console.log("Loading saved cookies...");
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} saved cookies`);
        } else {
            console.log("⚠️  No saved cookies found.");
            console.log("\nTO EXPORT COOKIES:");
            console.log("1. Install 'EditThisCookie' or 'Cookie-Editor' browser extension");
            console.log("2. Go to replit.com and log in");
            console.log("3. Click the extension and export all cookies as JSON");
            console.log("4. Save the JSON to 'replit_cookies.json' in your project folder");
            console.log("5. Re-run this script\n");
        }

        // Navigate to the Replit project
        console.log("Navigating to Replit project...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
        console.log("✓ Page loaded with Auto-Run script injected!");

        // Wait for page to stabilize
        await page.waitForTimeout(5000);

        // Save cookies for next time
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
        console.log(`✓ Saved ${cookies.length} cookies`);

        // Enable console logging from the page so you can see the userscript output
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Replit Auto-Run')) {
                console.log(`[Page Console] ${text}`);
            }
        });

        console.log("\n✓ Auto-Run script is now monitoring the page!");
        console.log("The script will check every 5 seconds and click Run if needed.");
        console.log("Browser will stay open... Press Ctrl+C to stop\n");

        // Keep the browser alive
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        console.log("Retrying in 30 seconds...");
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();