const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080);

// Function to find Chrome executable
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

async function logPageText(page) {
    try {
        console.log("\n========================================");
        console.log("WORKSPACE TEXT CONTENT:");
        console.log("========================================\n");

        const textContent = await page.evaluate(() => {
            // Get all text content from the body
            const bodyText = document.body.innerText;

            // Check if we're logged in
            const hasLoginButton = Array.from(document.querySelectorAll('button')).some(b => 
                b.innerText.includes('Log in') || b.innerText.includes('Create account')
            );

            // Also get some structural information
            const info = {
                title: document.title,
                url: window.location.href,
                loggedIn: !hasLoginButton,
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.innerText.trim()).filter(Boolean),
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim() || b.getAttribute('aria-label') || '[No text]').filter(Boolean).slice(0, 20),
                links: Array.from(document.querySelectorAll('a')).map(a => a.innerText.trim()).filter(Boolean).slice(0, 20),
                bodyText: bodyText
            };

            return info;
        });

        console.log("PAGE TITLE:", textContent.title);
        console.log("PAGE URL:", textContent.url);
        console.log("LOGGED IN:", textContent.loggedIn ? "✓ YES" : "✗ NO");
        console.log("\nHEADINGS:", textContent.headings.length > 0 ? textContent.headings.join(', ') : 'None found');
        console.log("\nBUTTONS (first 20):", textContent.buttons.length > 0 ? textContent.buttons.join(' | ') : 'None found');
        console.log("\nLINKS (first 20):", textContent.links.length > 0 ? textContent.links.join(' | ') : 'None found');
        console.log("\n--- FULL BODY TEXT ---");
        console.log(textContent.bodyText);
        console.log("\n========================================\n");

        return textContent.loggedIn;

    } catch (error) {
        console.log("Error logging page text:", error.message);
        return false;
    }
}

async function startBrowser() {
    console.log("Starting browser with persistent session...");
    try {
        const chromePath = findChrome();

        // Create a persistent user data directory
        const userDataDir = path.join(__dirname, 'chrome_user_data');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
            console.log("✓ Created user data directory:", userDataDir);
        }

        // Path to save/load cookies
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');

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
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        console.log("✓ Browser launched!");

        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Load saved cookies if they exist
        if (fs.existsSync(cookiesPath)) {
            console.log("Loading saved cookies...");
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} saved cookies`);
        } else {
            console.log("⚠️  No saved cookies found. You need to export cookies from your browser.");
            console.log("\nTO EXPORT COOKIES:");
            console.log("1. Install 'EditThisCookie' or 'Cookie-Editor' browser extension");
            console.log("2. Go to replit.com and log in");
            console.log("3. Click the extension and export all cookies as JSON");
            console.log("4. Save the JSON to 'replit_cookies.json' in your project folder");
            console.log("5. Re-run this script\n");
        }

        // Navigate to the Replit project
        console.log("Navigating to Replit project...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
        console.log("✓ Page loaded");

        // Wait for page to stabilize
        await page.waitForTimeout(5000);

        // Check if logged in
        const isLoggedIn = await logPageText(page);

        if (isLoggedIn) {
            // Save cookies for next time
            console.log("✓ Logged in successfully! Saving cookies...");
            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            console.log(`✓ Saved ${cookies.length} cookies for future use`);
        } else {
            console.log("\n✗ NOT LOGGED IN");
            console.log("Please export cookies from your browser and save to 'replit_cookies.json'\n");
        }

        // Refresh every 5 minutes
        setInterval(async () => {
            try {
                console.log("\n=== " + new Date().toLocaleTimeString() + " - Refreshing ===");
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
                console.log("✓ Page refreshed");

                await page.waitForTimeout(5000);
                const stillLoggedIn = await logPageText(page);

                if (stillLoggedIn) {
                    // Update saved cookies
                    const cookies = await page.cookies();
                    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
                }
            } catch (e) {
                console.log("✗ Refresh failed:", e.message);
            }
        }, 5 * 60 * 1000);

    } catch (err) {
        console.error("LAUNCH ERROR:", err.message);
        console.log("Full Error Stack:", err.stack);
        console.log("\nRetrying in 30 seconds...");

        setTimeout(() => {
            console.log("=== RETRYING BROWSER STARTUP ===");
            startBrowser();
        }, 30000);
    }
}

startBrowser();