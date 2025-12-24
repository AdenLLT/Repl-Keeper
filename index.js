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
        console.log("✓ Workspace loaded!");

        // Press Enter
        await page.type(String.fromCharCode(13));
        console.log("✓ Pressed Enter");

        // Wait 10 seconds
        console.log("Waiting 10 seconds...");
        await page.waitForTimeout(10000);

        // Press Enter again
        await page.type(String.fromCharCode(13));
        console.log("✓ Pressed Enter again");

        // Save cookies after initial load
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        console.log("✓ Page will refresh every 5 minutes");
        console.log("✓ Staying on workspace page continuously\n");

        // Refresh page every 5 minutes
        setInterval(async () => {
            try {
                console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Refreshing workspace...`);

                await page.goto(WORKSPACE_URL, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 90000 
                });
                console.log('✓ Workspace refreshed successfully');

                // Press Enter
                await page.keyboard.press('Enter');
                console.log("✓ Pressed Enter");

                // Wait 10 seconds
                console.log("Waiting 10 seconds...");
                await page.waitForTimeout(10000);

                // Press Enter again
                await page.keyboard.press('Enter');
                console.log("✓ Pressed Enter again");

                // Update cookies after refresh
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            } catch (e) {
                console.log('✗ Refresh failed:', e.message);
                // Try to get back to workspace
                try {
                    await page.goto(WORKSPACE_URL, { 
                        waitUntil: 'domcontentloaded', 
                        timeout: 90000 
                    });
                    console.log('✓ Recovered and back on workspace');
                } catch (err) {
                    console.log('✗ Could not return to workspace:', err.message);
                }
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Keep alive forever
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        console.log("Retrying in 30 seconds...");
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();