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

        // Inject Tampermonkey script
        await page.evaluateOnNewDocument(tampermonkeyScript);

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} cookies`);
        }

        console.log("Navigating to Replit...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
        console.log("✓ Page loaded with Tampermonkey script!");

        await page.waitForTimeout(5000);

        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        console.log("✓ Tampermonkey script is running!");

        // Keep alive
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();