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
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Enable console forwarding BEFORE navigation
        page.on('console', msg => {
            console.log(`[BROWSER] ${msg.text()}`);
        });

        // Handle page errors
        page.on('pageerror', error => {
            console.log(`[PAGE ERROR] ${error.message}`);
        });

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded (${cookies.length} cookies)`);
        } else {
            console.log('⚠️  No cookies found - you may need to log in first!');
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        await page.goto(WORKSPACE_URL, {
            waitUntil: 'networkidle2',
            timeout: 180000
        });

        console.log('⏳ Waiting for Replit interface to fully load (45 seconds)...');
        await sleep(45000);

        console.log('✓ Page loaded. Injecting COMPLETE userscript with refresh...');

        // Inject the COMPLETE userscript INCLUDING refresh logic
        await page.addScriptTag({
            content: `
(function() {
    'use strict';
    console.log('🚀 Replit Keeper v2.0: Initializing...');

    const RUN_BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
    // This looks for the specific SVG path of the Play icon
    const PLAY_ICON_PATH = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18'; 

    // Helper to find elements even inside Shadow Roots
    function querySelectorAllShadow(selector, root = document) {
        const elements = Array.from(root.querySelectorAll(selector));
        const shadowRoots = Array.from(root.querySelectorAll('*'))
            .map(el => el.shadowRoot)
            .filter(Boolean);
        for (const shadowRoot of shadowRoots) {
            elements.push(...querySelectorAllShadow(selector, shadowRoot));
        }
        return elements;
    }

    function triggerClick(el) {
        console.log('⚡ Attempting to click Run button...');
        ['mousedown', 'mouseup', 'click'].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            }));
        });
    }

    function monitor() {
        // Find all buttons matching the selector, even in shadow roots
        const buttons = querySelectorAllShadow(RUN_BUTTON_SELECTOR);
        const runButton = buttons[0];

        if (runButton) {
            const html = runButton.innerHTML;
            // Check if the "Play" icon is present (meaning it's NOT running)
            if (html.includes(PLAY_ICON_PATH)) {
                console.log('▶️ App is stopped. Clicking Run...');
                triggerClick(runButton);
            } else {
                console.log('✅ App is already running (Stop icon detected).');
            }
        } else {
            console.log('🔍 Searching for Run button...');
        }
    }

    // Run every 10 seconds
    setInterval(monitor, 10000);

    // Auto-reload page every 15 minutes to clear memory
    setTimeout(() => {
        console.log('🔄 Periodic reload to keep session fresh...');
        window.location.reload();
    }, 900000);
})();
            `
        });

        console.log('✓ COMPLETE Userscript injected (with refresh logic)!');

        // Wait a bit to see if script logs appear
        await sleep(10000);
        console.log('✓ Script should now be running. Monitoring console output...');

        // Periodic cookie saving
        setInterval(async () => {
            try {
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            } catch (err) {
                console.log(`⚠️  Error saving cookies: ${err.message}`);
            }
        }, 60000);

        // Keep alive
        await new Promise(() => {});

    } catch (err) {
        console.error("❌ Error:", err.message);
        console.error("Stack trace:", err.stack);

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