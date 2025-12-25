const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper is Active - No Extension Needed'));
app.listen(8080);

function findChrome() {
    const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        process.env.CHROME_PATH,
    ].filter(Boolean);
    for (const p of paths) { if (fs.existsSync(p)) return p; }
    throw new Error('Chrome executable not found');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function cleanupLockFiles(userDataDir) {
    try {
        const lockFile = path.join(userDataDir, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
            console.log('✓ Cleaned up lock file');
        }
    } catch (err) {
        console.log('⚠️  Could not clean lock file:', err.message);
    }
}

let browser = null;

async function startBrowser() {
    console.log("Starting browser...");

    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');

    try {
        cleanupLockFiles(userDataDir);

        const chromePath = findChrome();

        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded (${cookies.length} cookies)`);
        } else {
            console.log('⚠️  No cookies found - you may need to log in first!');
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        // Enable console forwarding BEFORE navigation
        page.on('console', msg => {
            console.log(`[BROWSER] ${msg.text()}`);
        });

        await page.goto(WORKSPACE_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 180000
        });

        console.log('⏳ Waiting for Replit interface to fully load (30 seconds)...');
        await sleep(30000);

        console.log('✓ Page loaded. Injecting userscript...');

        // Inject the EXACT userscript into the page (minus the refresh logic)
        await page.addScriptTag({
            content: `
            (function() {
            (function() {
                'use strict';
                // --- Configuration for Auto-Run Button Logic ---
                // Set the interval to check for the Run button every 5 seconds (5000ms)
                const CHECK_INTERVAL_MS = 5000;
                // The definitive selector for the button component
                const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
                // The 'd' attribute path data for the Play/Run triangle icon
                const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

                // Function to simulate a full click sequence
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
                    // 1. Check if the button element exists
                    if (button) {
                        // 2. Look for the SVG path element inside the button
                        const iconPath = button.querySelector('svg path');
                        // 3. Check if the SVG path exists and if its 'd' attribute matches the RUN icon
                        if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {
                            // It's the RUN button icon! Execute the click.
                            simulateMouseClick(button);
                            console.log('Replit Auto-Run (v1.8): Found RUN icon (Play). Restarting service.');
                        } else {
                            // If it's not the RUN icon (it's likely the Stop square or loading spinner), do nothing.
                            console.log('Replit Auto-Run (v1.8): Button found, but icon is NOT the RUN (Play) triangle. App is running or stopping.');
                        }
                    } else {
                        console.log('Replit Auto-Run (v1.8): Button component not found. Retrying in 5 seconds.');
                    }
                }

                // --- Start Execution ---
                // Start the continuous monitoring loop for the Run button
                console.log('Replit Auto-Run (v1.8): Starting state-aware monitor. Checking every 5 seconds.');
                setInterval(monitorAndClickRunButton, CHECK_INTERVAL_MS);
            })();
            `
        });

        console.log('✓ Userscript injected and running!');

        // Periodic cookie saving from Node.js side
        setInterval(async () => {
            try {
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            } catch (err) {
                console.log(`⚠️  Error saving cookies: ${err.message}`);
            }
        }, 60000); // Save cookies every minute

        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);

        if (browser) {
            try {
                await browser.close();
                console.log('✓ Browser closed');
            } catch (closeErr) {
                console.log('⚠️  Error closing browser:', closeErr.message);
            }
        }

        cleanupLockFiles(userDataDir);
        console.log('⏳ Restarting in 30 seconds...');
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();