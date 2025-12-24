const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080);

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

const tampermonkeyScript = `
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
                console.log('Replit Auto-Run (v1.7): Found RUN icon (Play). Restarting service.');
            } else {
                console.log('Replit Auto-Run (v1.7): Button found, but icon is NOT the RUN (Play) triangle. App is running or stopping.');
            }
        } else {
            console.log('Replit Auto-Run (v1.7): Button component not found. Retrying in 5 seconds.');
        }
    }

    console.log('Replit Auto-Run (v1.7): Starting state-aware monitor. Checking every 5 seconds.');
    setInterval(monitorAndClickRunButton, CHECK_INTERVAL_MS);
})();
`;

async function checkButton(page) {
    try {
        console.log('🔍 Manually checking for Run button...');
        const buttonExists = await page.evaluate(() => {
            const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
            const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

            const button = document.querySelector(BUTTON_SELECTOR);

            if (button) {
                const iconPath = button.querySelector('svg path');

                if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {
                    const dispatchEvent = (type) => {
                        const event = new MouseEvent(type, {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        button.dispatchEvent(event);
                    };
                    dispatchEvent('mousedown');
                    dispatchEvent('mouseup');
                    dispatchEvent('click');
                    return 'CLICKED';
                } else {
                    return 'RUNNING';
                }
            }
            return 'NOT_FOUND';
        });

        if (buttonExists === 'CLICKED') {
            console.log('✅ Manually clicked Run button!');
        } else if (buttonExists === 'RUNNING') {
            console.log('⏸️  App is already running');
        } else {
            console.log('❌ Button not found');
        }
    } catch (error) {
        console.log('Error checking button:', error.message);
    }
}

async function startBrowser() {
    console.log("Starting browser...");
    try {
        const chromePath = findChrome();
        const userDataDir = path.join(__dirname, 'chrome_user_data');
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');

        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

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

        // Inject Tampermonkey script on EVERY new document
        await page.evaluateOnNewDocument(tampermonkeyScript);

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} cookies`);
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        console.log("Navigating to Replit workspace...");
        await page.goto(WORKSPACE_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
        console.log("✓ Workspace loaded with Tampermonkey script!");

        await page.waitForTimeout(5000);

        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        console.log("✓ Tampermonkey script is running!");
        console.log("✓ Manual button check every 5 minutes");
        console.log("✓ Page refresh every 6 minutes");
        console.log("✓ Will NEVER leave workspace page\n");

        // Check button every 5 minutes
        setInterval(async () => {
            console.log(`\n⏰ [${new Date().toLocaleTimeString()}] 5-minute button check`);

            // Make sure we're still on the workspace page
            const currentUrl = page.url();
            if (!currentUrl.includes('replit.com/@HUDV1/mb')) {
                console.log('⚠️  OFF WORKSPACE PAGE! Navigating back...');
                await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
                await page.waitForTimeout(5000);
            }

            await checkButton(page);
        }, 5 * 60 * 1000); // 5 minutes

        // Refresh page every 6 minutes
        setInterval(async () => {
            try {
                console.log(`\n🔄 [${new Date().toLocaleTimeString()}] 6-minute page refresh`);

                // Always go to the workspace URL, never navigate away
                await page.goto(WORKSPACE_URL, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 90000 
                });
                console.log('✓ Workspace refreshed');

                await page.waitForTimeout(5000);

                // Update cookies
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

                // Check button after refresh
                await checkButton(page);
            } catch (e) {
                console.log('✗ Refresh failed:', e.message);
                // Try to get back to workspace
                try {
                    await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
                } catch (err) {
                    console.log('✗ Could not return to workspace:', err.message);
                }
            }
        }, 6 * 60 * 1000); // 6 minutes

        // Keep alive forever
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        console.log("Retrying in 30 seconds...");
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();