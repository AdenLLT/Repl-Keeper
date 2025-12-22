const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const express = require('express');

// 1. Web server to pass Koyeb Health Checks
const app = express();
app.get('/', (req, res) => res.send('Replit Project Keeper is Active!'));
app.listen(8080);

async function startBrowser() {
    let chromePath;
    try {
        // Automatically finds where the browser is installed in the Docker image
        chromePath = execSync('which google-chrome-stable || which google-chrome || which chromium').toString().trim();
        console.log("Found browser at:", chromePath);
    } catch (e) {
        console.error("Could not find browser path automatically.");
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Vital for low-memory environments
            '--single-process',         // Saves memory
            '--no-zygote'
        ]
    });

    const page = await browser.newPage();

    // Set a desktop-sized viewport so the full editor loads properly
    await page.setViewport({ width: 1280, height: 800 });

    // AUTHENTICATION: Using your provided session cookie
    await page.setCookie({
        name: 'connect.sid',
        value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA',
        domain: 'replit.com'
    });

    console.log("Navigating to project: HUDV1/mb...");
    try {
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'networkidle2',
            timeout: 90000 
        });
        console.log("Successfully loaded Replit project page.");
    } catch (err) {
        console.log("Initial load failed or timed out. Keeper will keep trying...");
    }

    // Keep-alive loop: Prevents Replit from sleeping by simulating activity
    setInterval(async () => {
        try {
            console.log("Performing activity to stay online: " + new Date().toLocaleTimeString());

            // Random mouse movement to simulate human interaction
            await page.mouse.move(Math.floor(Math.random() * 500), Math.floor(Math.random() * 500));

            // Reload the page to keep the web socket connection alive
            await page.reload({ waitUntil: 'networkidle2' });
            console.log("Reload successful.");
        } catch (e) {
            console.log("Session interrupted, attempting to reconnect...");
            try {
                await page.goto('https://replit.com/@HUDV1/mb#main.py', { waitUntil: 'networkidle2' });
            } catch (retryErr) {
                console.log("Reconnect failed, will try again next cycle.");
            }
        }
    }, 5 * 60 * 1000); // Runs every 5 minutes
}

// Start the process and catch any immediate launch errors
startBrowser().catch(err => {
    console.error("FATAL LAUNCH ERROR:", err);
    process.exit(1);
});