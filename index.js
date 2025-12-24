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

    for (const p of paths) {
        if (fs.existsSync(p)) {
            console.log(`Found Chrome at: ${p}`);
            return p;
        }
    }

    throw new Error('Chrome executable not found');
}

// Function to click the run button from Node.js side
async function clickRunButton(page) {
    try {
        const clicked = await page.evaluate(() => {
            const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
            const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

            const button = document.querySelector(BUTTON_SELECTOR);

            if (button) {
                const iconPath = button.querySelector('svg path');

                if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {
                    button.click();
                    return 'CLICKED - Run button found and clicked';
                } else {
                    return 'SKIPPED - Button found but not in RUN state';
                }
            }
            return 'NOT_FOUND - Button not found';
        });

        console.log(`[${new Date().toLocaleTimeString()}] ${clicked}`);
        return clicked;
    } catch (error) {
        console.log(`[${new Date().toLocaleTimeString()}] ERROR:`, error.message);
        return 'ERROR';
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

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Load cookies if they exist
        if (fs.existsSync(cookiesPath)) {
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} cookies`);
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        console.log("Navigating to Replit workspace...");
        await page.goto(WORKSPACE_URL, { 
            waitUntil: 'networkidle2',
            timeout: 90000 
        });
        console.log("✓ Workspace loaded!");

        // Wait for page to fully load
        await page.waitForTimeout(10000);

        // Save cookies after first load
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        console.log("\n✓ Starting monitor loop...\n");

        // Monitor and click from Node.js side every 5 seconds
        const monitorInterval = setInterval(async () => {
            await clickRunButton(page);
        }, 5000);

        // Refresh every 6 minutes
        const refreshInterval = setInterval(async () => {
            try {
                console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Refreshing page...`);

                await page.goto(WORKSPACE_URL, { 
                    waitUntil: 'networkidle2', 
                    timeout: 90000 
                });

                console.log('✓ Page reloaded, waiting for content...');
                await page.waitForTimeout(10000);

                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

                console.log('✓ Refresh complete\n');
            } catch (e) {
                console.log('✗ Refresh failed:', e.message);
            }
        }, 6 * 60 * 1000);

        // Keep process alive
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        console.log("Restarting in 30 seconds...");
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();