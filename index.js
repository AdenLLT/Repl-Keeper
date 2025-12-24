const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Create a simple web server so we know the bot is running
const app = express();
app.get('/', (req, res) => res.send('✅ Keeper is Active and Running!'));
app.listen(8080, () => {
    console.log('🌐 Web server running on port 8080');
});

// This function finds where Chrome is installed on your computer
function findChrome() {
    const paths = [
        '/usr/bin/google-chrome',          // Linux
        '/usr/bin/chromium',                // Linux
        '/usr/bin/chromium-browser',        // Linux
        '/usr/bin/google-chrome-stable',    // Linux
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',  // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',  // Windows
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',  // Mac
        process.env.CHROME_PATH,            // Custom path if you set one
    ].filter(Boolean);

    for (const chromePath of paths) {
        if (fs.existsSync(chromePath)) {
            console.log(`✅ Found Chrome at: ${chromePath}`);
            return chromePath;
        }
    }

    throw new Error('❌ Chrome not found! Please install Google Chrome.');
}

// Main function that starts the browser
async function startBrowser() {
    console.log('\n🚀 Starting Replit Keeper Bot...\n');

    try {
        // Set up paths
        const chromePath = findChrome();
        const userDataDir = path.join(__dirname, 'chrome_user_data');
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');
        const extensionPath = path.join(__dirname, 'tampermonkey-extension');

        // Create chrome_user_data folder if it doesn't exist
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
            console.log('📁 Created chrome_user_data folder');
        }

        // Check if Tampermonkey extension exists
        if (!fs.existsSync(extensionPath)) {
            console.log('\n❌ TAMPERMONKEY EXTENSION NOT FOUND!\n');
            console.log('📋 Please follow these steps:');
            console.log('1. Go to: https://crxextractor.com/');
            console.log('2. Paste this URL: https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo');
            console.log('3. Download and extract it');
            console.log('4. Put all files in: tampermonkey-extension/ folder');
            console.log('5. Run this script again\n');
            process.exit(1);
        }

        console.log('✅ Tampermonkey extension found!');

        // Launch Chrome with Tampermonkey
        console.log('🌐 Launching Chrome browser...');
        const browser = await puppeteer.launch({
            headless: false,  // We need to see the browser for extensions to work
            executablePath: chromePath,
            userDataDir: userDataDir,  // Saves your settings between runs
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',  // Hides that it's a bot
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                '--start-maximized',
                '--disable-web-security',  // Sometimes needed for extensions
            ]
        });

        console.log('✅ Browser launched with Tampermonkey!\n');

        // Create a new page (tab)
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Load cookies if they exist (keeps you logged in)
        if (fs.existsSync(cookiesPath)) {
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`🍪 Loaded ${cookies.length} saved cookies`);
        }

        // Give Tampermonkey time to load
        console.log('⏳ Waiting for Tampermonkey to load...');
        await page.waitForTimeout(3000);

        // Navigate to your Replit project
        console.log('🌐 Opening Replit page...');
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });

        console.log('✅ Page loaded successfully!');

        // Save cookies for next time
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
        console.log('💾 Saved cookies for next run');

        console.log('\n' + '='.repeat(50));
        console.log('🎉 BOT IS NOW RUNNING!');
        console.log('='.repeat(50));
        console.log('✅ Tampermonkey is active');
        console.log('✅ Your script should be running');
        console.log('✅ Replit will stay alive');
        console.log('\n💡 Keep this window open!');
        console.log('🛑 Press Ctrl+C to stop the bot\n');

        // Keep checking if browser is still open
        browser.on('disconnected', () => {
            console.log('\n⚠️  Browser closed! Restarting in 10 seconds...');
            setTimeout(() => startBrowser(), 10000);
        });

    } catch (err) {
        console.error('\n❌ ERROR OCCURRED:', err.message);
        console.log('\n🔄 Retrying in 30 seconds...');
        setTimeout(() => startBrowser(), 30000);
    }
}

// Start the bot!
console.log('╔════════════════════════════════════════╗');
console.log('║   REPLIT AUTO-KEEPER BOT v1.0         ║');
console.log('╚════════════════════════════════════════╝\n');

startBrowser();