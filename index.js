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

async function startBrowser() {
    console.log("Starting browser...");
    try {
        const chromePath = findChrome();
        const userDataDir = path.join(__dirname, 'chrome_user_data');
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');

        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

        const browser = await puppeteer.launch({
            headless: "new",
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
            await page.goto(WORKSPACE_URL, { waitUntil: 'networkidle2', timeout: 90000 });

            console.log('⏳ Waiting for page to fully render (15 seconds)...');
            await sleep(15000); // Give Replit's React app time to fully load

            // Click the run button 3 times with 10 second delays
            for (let i = 1; i <= 3; i++) {
                console.log(`\n🎯 Attempt ${i}/3 - Looking for button...`);

                try {
                    // Wait for the button to appear (up to 10 seconds)
                    await page.waitForSelector('button[data-cy="ws-run-btn"]', { timeout: 10000 });
                    console.log('✓ Button found in DOM');

                    // Check what's actually there and try to click
                    const result = await page.evaluate(() => {
                        const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
                        const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

                        const button = document.querySelector(BUTTON_SELECTOR);
                        if (!button) {
                            return { found: false, reason: 'Button not in DOM' };
                        }

                        const iconPath = button.querySelector('svg path');
                        if (!iconPath) {
                            return { found: true, clicked: false, reason: 'No SVG path found' };
                        }

                        const pathData = iconPath.getAttribute('d');
                        if (pathData !== RUN_ICON_PATH_DATA) {
                            return { 
                                found: true, 
                                clicked: false, 
                                reason: 'Not in RUN state (probably STOP state)',
                                actualPath: pathData ? pathData.substring(0, 50) + '...' : 'null'
                            };
                        }

                        // Click the button
                        button.click();

                        // Also try the mouse event simulation as backup
                        ['mousedown', 'mouseup', 'click'].forEach(t => 
                            button.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
                        );

                        return { found: true, clicked: true, reason: 'Clicked successfully' };
                    });

                    console.log(`📊 Result:`, JSON.stringify(result, null, 2));

                    if (result.clicked) {
                        console.log(`✅ Click ${i}/3 successful!`);
                    } else {
                        console.log(`⚠️  Click ${i}/3 - ${result.reason}`);
                    }

                } catch (err) {
                    console.log(`❌ Click ${i}/3 - Error: ${err.message}`);
                }

                // Wait 10 seconds before next click (except after the last one)
                if (i < 3) {
                    console.log(`⏱️  Waiting 10 seconds before next click...`);
                    await sleep(10000);
                }
            }

            console.log(`\n✅ Completed all 3 click attempts`);

            // Save cookies
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