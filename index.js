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

        await page.waitForTimeout(5000);

        // Wait 10 seconds before pressing 'M' key twice
        console.log("Waiting 10 seconds before pressing 'M' key...");
        await page.waitForTimeout(10000);

        // Click on the page to ensure focus (with error handling)
        console.log("Clicking page to ensure focus...");
        try {
            await page.evaluate(() => document.body.click());
            console.log("✓ Page focused");
        } catch (e) {
            console.log("⚠️  Click failed, continuing anyway:", e.message);
        }
        await page.waitForTimeout(1000);

        console.log("Pressing 'M' key twice using ALL METHODS...");

        // FIRST M PRESS
        console.log("FIRST M PRESS:");

        // Method 1: keyboard.press with text option (CRITICAL!)
        page.keyboard.press('Enter');
        console.log("  ✓ Method 1: press with text option");
        await page.waitForTimeout(300);

        // Method 2: keyboard.down + keyboard.up with text
        await page.keyboard.press('\n');
        await page.keyboard.press('\n');
        console.log("  ✓ Method 2: down/up with text");
        await page.waitForTimeout(300);

        // Method 3: page.type (this is the most reliable)
        await page.type('m');
        console.log("  ✓ Method 3: page.type");
        await page.waitForTimeout(300);

        // Method 4: keyboard.type
        await page.keyboard.type('m');
        console.log("  ✓ Method 4: keyboard.type");
        await page.waitForTimeout(500);

        // SECOND M PRESS
        console.log("SECOND M PRESS:");

        await page.keyboard.press('\n');
        console.log("  ✓ Method 1: press with text option");
        await page.waitForTimeout(300);

        await page.keyboard.press('\n');
        console.log("  ✓ Method 2: down/up with text");
        await page.waitForTimeout(300);

        await page.type('m');
        console.log("  ✓ Method 3: page.type");
        await page.waitForTimeout(300);

        await page.keyboard.type('m');
        console.log("  ✓ Method 4: keyboard.type");

        console.log("✅ PRESSED 'M' KEY 8 TIMES TOTAL USING ALL METHODS!");

        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        console.log("✓ Page refresh every 1 minute (TESTING MODE)");
        console.log("✓ Will NEVER leave workspace page\n");

        // Refresh page every 1 MINUTE (for testing)
        setInterval(async () => {
            try {
                console.log(`\n🔄 [${new Date().toLocaleTimeString()}] 1-minute page refresh (TESTING)`);

                // Always go to the workspace URL, never navigate away
                await page.goto(WORKSPACE_URL, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 90000 
                });
                console.log('✓ Workspace refreshed');

                await page.waitForTimeout(5000);

                // Wait 10 seconds before pressing 'M' key twice after refresh
                console.log("Waiting 10 seconds before pressing 'M' key...");
                await page.waitForTimeout(10000);

                // Click on the page to ensure focus (with error handling)
                console.log("Clicking page to ensure focus...");
                try {
                    await page.evaluate(() => document.body.click());
                    console.log("✓ Page focused");
                } catch (e) {
                    console.log("⚠️  Click failed, continuing anyway:", e.message);
                }
                await page.waitForTimeout(1000);

                console.log("Pressing 'M' key twice using multiple methods...");

                // Method 4: Using character code (77 is 'M')
                await page.keyboard.press(String.fromCharCode(77));
                console.log("  ✓ Method 4: char code 77");
                await page.waitForTimeout(500);

                console.log("SECOND M PRESS:");

                await page.keyboard.press(String.fromCharCode(77));
                console.log("  ✓ Method 4: char code 77");

                console.log("✓ Pressed 'M' key using all available methods!");

                // Update cookies
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            } catch (e) {
                console.log('✗ Refresh failed:', e.message);
                // Try to get back to workspace
                try {
                    await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
                } catch (err) {
                    console.log('✗ Could not return to workspace:', err.message);
                }
            }
        }, 1 * 60 * 1000); // 1 MINUTE (for testing)

        // Keep alive forever
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        console.log("Retrying in 30 seconds...");
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();