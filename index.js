const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Replit Project Keeper is Active!'));
app.listen(8080);

async function startBrowser() {
    let chromePath;
    try {
        // This command looks for the chrome executable anywhere in the system
        chromePath = execSync('which google-chrome-stable || which google-chrome || which chromium').toString().trim();
    } catch (e) {
        // Fallback to the most common Puppeteer Docker path if 'which' fails
        chromePath = '/usr/bin/google-chrome'; 
    }

    console.log(`Found browser at: ${chromePath}`);

    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: chromePath,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Helps with memory issues on free tiers
            '--single-process'         // Saves RAM on small instances
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.setCookie({
        name: 'connect.sid',
        value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA', // Ensure this is just the value, no "connect.sid=" prefix
        domain: 'replit.com'
    });

    console.log("Navigating to project: HUDV1/mb...");
    await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
        waitUntil: 'networkidle2',
        timeout: 90000 
    });

    console.log("Page loaded. Keeper is active.");

    setInterval(async () => {
        try {
            console.log("Refreshing session...");
            await page.reload({ waitUntil: 'networkidle2' });
        } catch (e) {
            await page.goto('https://replit.com/@HUDV1/mb#main.py');
        }
    }, 5 * 60 * 1000);
}

startBrowser().catch(err => {
    console.error("CRITICAL ERROR:", err);
    process.exit(1);
});