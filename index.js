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

        const browser = await puppeteer.launch({
            headless: false, // ⚠️ Set to FALSE so you can log in manually the first time
            executablePath: chromePath,
            userDataDir: userDataDir, // This preserves login session
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        console.log("✓ Browser launched with persistent session!");

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log("\n========================================");
        console.log("FIRST TIME SETUP INSTRUCTIONS:");
        console.log("========================================");
        console.log("1. A Chrome window will open");
        console.log("2. Manually log into Replit in that window");
        console.log("3. Navigate to your project: https://replit.com/@HUDV1/mb#main.py");
        console.log("4. Once logged in, the script will take over");
        console.log("5. After first login, you can set headless: true");
        console.log("========================================\n");

        // Navigate to the Replit project
        console.log("Navigating to Replit project...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
        console.log("✓ Page loaded");

        // Wait a bit for any redirects or page loads
        await page.waitForTimeout(5000);

        // Check if logged in
        const isLoggedIn = await logPageText(page);

        if (!isLoggedIn) {
            console.log("\n⚠️  NOT LOGGED IN");
            console.log("Please log in manually in the browser window that opened.");
            console.log("Once you're logged in and see your workspace, the script will continue automatically.\n");

            // Wait for user to log in (check every 10 seconds)
            let attempts = 0;
            while (!isLoggedIn && attempts < 60) { // Wait up to 10 minutes
                await page.waitForTimeout(10000);
                attempts++;
                const checkLoggedIn = await page.evaluate(() => {
                    const hasLoginButton = Array.from(document.querySelectorAll('button')).some(b => 
                        b.innerText.includes('Log in') || b.innerText.includes('Create account')
                    );
                    return !hasLoginButton;
                });

                if (checkLoggedIn) {
                    console.log("✓ Login detected! Continuing...");
                    await logPageText(page);
                    break;
                }
            }
        }

        // Refresh every 5 minutes
        setInterval(async () => {
            try {
                console.log("\n=== " + new Date().toLocaleTimeString() + " - Refreshing ===");
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
                console.log("✓ Page refreshed");

                await page.waitForTimeout(5000);
                await logPageText(page);
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