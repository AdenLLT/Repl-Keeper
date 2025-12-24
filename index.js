const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Option 1: Serve the userscripts folder so the browser can download the script via HTTP
app.use('/scripts', express.static(path.join(__dirname, 'userscripts')));
app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080, () => console.log("✓ Local server hosting scripts on port 8080"));

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
        const extensionPath = path.join(__dirname, 'tampermonkey-extension');

        // This is the filename inside your userscripts/ folder
        const scriptFileName = 'replit-keeper.user.js'; 

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
                '--no-zygote',
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`
            ]
        });

        console.log("✓ Browser launched with Tampermonkey!");

        const page = await browser.newPage();

        // --- INSTALL USERSCRIPT VIA LOCALHOST (FIXES ERR_ABORTED) ---
        console.log(`Triggering Userscript installation from http://localhost:8080/scripts/${scriptFileName}`);

        // Navigating to the HTTP URL allows Tampermonkey to detect the .user.js extension
        await page.goto(`http://localhost:8080/scripts/${scriptFileName}`, { waitUntil: 'networkidle0' });

        // Wait for Tampermonkey to parse the script and open the install tab
        await new Promise(r => setTimeout(r, 3000)); 

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
        console.log("✓ Workspace loaded! Tampermonkey is now active.");

        // Press Enter
        await page.keyboard.press('Enter');
        console.log("✓ Pressed Enter");

        // Wait 10 seconds
        await new Promise(r => setTimeout(r, 10000));

        // Press Enter again
        await page.keyboard.press('Enter');
        console.log("✓ Pressed Enter again");

        // Save cookies
        const currentCookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(currentCookies, null, 2));

        // Refresh loop
        setInterval(async () => {
            try {
                console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Refreshing...`);
                await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 10000));
                await page.keyboard.press('Enter');

                const updatedCookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(updatedCookies, null, 2));
            } catch (e) {
                console.log('✗ Refresh failed:', e.message);
            }
        }, 5 * 60 * 1000); 

        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);
        console.log("Retrying in 30 seconds...");
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();