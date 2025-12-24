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

async function startBrowser() {
    console.log("Starting browser...");
    try {
        const chromePath = findChrome();
        const userDataDir = path.join(__dirname, 'chrome_user_data');
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');

        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

        const browser = await puppeteer.launch({
            headless: "new", // Now works perfectly in headless mode!
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded`);
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        const runLogic = async () => {
            console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Refreshing/Checking Workspace...`);
            await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // --- INJECT YOUR USERSCRIPT LOGIC HERE ---
            await page.evaluate(() => {
                const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
                const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

                const simulateClick = (el) => {
                    ['mousedown', 'mouseup', 'click'].forEach(t => 
                        el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
                    );
                };

                const button = document.querySelector(BUTTON_SELECTOR);
                if (button) {
                    const iconPath = button.querySelector('svg path');
                    if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {
                        simulateClick(button);
                        console.log('Injected Script: Found RUN icon. Clicking!');
                    } else {
                        console.log('Injected Script: Icon is NOT Run (Triangle). Skipping.');
                    }
                }
            });
            // ------------------------------------------

            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
        };

        // Initial Run
        await runLogic();

        // Run every 5 minutes to keep page fresh
        setInterval(runLogic, 5 * 60 * 1000);

        await new Promise(() => {});
    } catch (err) {
        console.error("Error:", err.message);
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();