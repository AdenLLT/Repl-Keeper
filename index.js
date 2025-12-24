const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Simple health check for the keeper
app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function findChrome() {
    const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        process.env.CHROME_PATH,
    ].filter(Boolean);

    for (const path of paths) {
        if (fs.existsSync(path)) return path;
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

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Loaded cookies`);
        }

        console.log("Navigating to Replit...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'networkidle2', 
            timeout: 90000 
        });

        console.log("Waiting 10 seconds for workspace to settle...");
        await delay(10000);

        console.log("Executing key sequence: M + M");
        await page.keyboard.press('m');
        await delay(1000); // Short gap between presses
        await page.keyboard.press('m');

        console.log("✓ Sequence complete.");

        // Update cookies for the next session
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        // Stay alive
        console.log("Keeping session active...");
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        console.log("Retrying in 30 seconds...");
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();