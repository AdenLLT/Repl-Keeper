const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Basic web server to keep Koyeb health checks happy
app.get('/', (req, res) => res.send('Keeper is Active - v2.1 (External Reload)'));
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

// The Userscript to be injected
const KEEPER_SCRIPT = `
(function() {
    'use strict';
    console.log('🚀 Replit Keeper v2.1: Injected and Monitoring...');

    const RUN_BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
    const PLAY_ICON_PATH = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18'; 

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
                view: window, bubbles: true, cancelable: true, buttons: 1
            }));
        });
    }

    function monitor() {
        const buttons = querySelectorAllShadow(RUN_BUTTON_SELECTOR);
        const runButton = buttons[0];

        if (runButton) {
            const html = runButton.innerHTML;
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

    setInterval(monitor, 10000);
})();
`;

async function startBrowser() {
    console.log("Starting browser...");
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');
    let browser = null;

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
                '--disable-blink-features=AutomationControlled', // Bypass bot detection
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', error => console.log(`[PAGE ERROR] ${error.message}`));

        // Listen for crash/disconnect to restart the whole process
        browser.on('disconnected', () => { throw new Error('Browser disconnected'); });

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded (${cookies.length} cookies)`);
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        const loadAndInject = async () => {
            console.log('⏳ Navigating to Workspace...');
            await page.goto(WORKSPACE_URL, { waitUntil: 'networkidle2', timeout: 120000 });
            console.log('⏳ Waiting 45s for UI hydration...');
            await sleep(45000);
            await page.addScriptTag({ content: KEEPER_SCRIPT });
            console.log('✓ Keeper script injected.');
        };

        await loadAndInject();

        // REFRESH LOGIC: Every 15 minutes, reload the page via Node.js
        const refreshInterval = setInterval(async () => {
            try {
                console.log('🔄 Performing scheduled 15-minute reload...');
                await loadAndInject();
            } catch (err) {
                console.log('⚠️ Reload failed:', err.message);
            }
        }, 900000);

        // COOKIE SAVING: Every 5 minutes
        const cookieInterval = setInterval(async () => {
            try {
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            } catch (err) { console.log('⚠️ Cookie save error'); }
        }, 300000);

        // Keep the function alive
        await new Promise(() => {});

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        if (browser) await browser.close();
        console.log('⏳ Restarting total process in 30 seconds...');
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();