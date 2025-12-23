const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
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

            // Also get some structural information
            const info = {
                title: document.title,
                url: window.location.href,
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.innerText.trim()).filter(Boolean),
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim() || b.getAttribute('aria-label') || '[No text]').filter(Boolean).slice(0, 20), // First 20 buttons
                links: Array.from(document.querySelectorAll('a')).map(a => a.innerText.trim()).filter(Boolean).slice(0, 20), // First 20 links
                bodyText: bodyText
            };

            return info;
        });

        console.log("PAGE TITLE:", textContent.title);
        console.log("PAGE URL:", textContent.url);
        console.log("\nHEADINGS:", textContent.headings.length > 0 ? textContent.headings.join(', ') : 'None found');
        console.log("\nBUTTONS (first 20):", textContent.buttons.length > 0 ? textContent.buttons.join(' | ') : 'None found');
        console.log("\nLINKS (first 20):", textContent.links.length > 0 ? textContent.links.join(' | ') : 'None found');
        console.log("\n--- FULL BODY TEXT ---");
        console.log(textContent.bodyText);
        console.log("\n========================================\n");

    } catch (error) {
        console.log("Error logging page text:", error.message);
    }
}

async function startBrowser() {
    console.log("Starting browser with explicit path...");
    try {
        const chromePath = findChrome();

        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        console.log("Browser launched successfully!");

        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // STEP 1: Go to replit.com first to establish the domain
        console.log("STEP 1: Visiting replit.com to establish domain...");
        await page.goto('https://replit.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        console.log("✓ Domain established");

        // STEP 2: Now set the cookies
        console.log("STEP 2: Setting authentication cookies...");
        await page.setCookie({
            name: 'connect.sid',
            value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA',
            domain: 'replit.com',
            path: '/',
            httpOnly: true,
            secure: true
        });
        console.log("✓ Cookies set");

        // STEP 3: Now navigate to your specific Replit project WITH the cookies
        console.log("STEP 3: Navigating to your Replit project with authentication...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
        console.log("✓ Initial page loaded");

        // STEP 4: Wait for the workspace to actually load (not just the loading screen)
        console.log("STEP 4: Waiting for workspace to fully load...");

        // Wait for the loading animation to disappear and actual content to appear
        await page.waitForFunction(() => {
            // Check if we're past the loading screen by looking for workspace elements
            const title = document.title;
            return title !== 'Loading... - Replit' && title.includes('Replit');
        }, { timeout: 120000 });

        console.log("✓ Workspace loaded!");

        // Wait an additional moment for UI to stabilize
        await page.waitForTimeout(5000);

        // Log all visible text on the workspace
        await logPageText(page);

        // Refresh every 5 minutes
        setInterval(async () => {
            try {
                console.log("\n=== " + new Date().toLocaleTimeString() + " - Refreshing ===");
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
                console.log("✓ Page refreshed");

                // Wait for workspace to load after refresh
                await page.waitForFunction(() => {
                    const title = document.title;
                    return title !== 'Loading... - Replit' && title.includes('Replit');
                }, { timeout: 120000 });

                await page.waitForTimeout(5000);

                // Log text content after refresh
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