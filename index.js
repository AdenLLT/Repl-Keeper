const puppeteer = require('puppeteer-core');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080);

async function startBrowser() {
    // This helper function finds the correct path automatically within the container
    const autoPath = '/usr/bin/google-chrome-stable'; 

    console.log("Starting browser...");

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            // We'll use this direct path which is the standard for the Google image
            executablePath: autoPath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });

        const page = await browser.newPage();

        await page.setCookie({
            name: 'connect.sid',
            value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA', // Your cookie
            domain: 'replit.com'
        });

        console.log("Opening Replit project...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        console.log("SUCCESS: Replit is open and being kept alive.");

        setInterval(async () => {
            try {
                await page.reload({ waitUntil: 'networkidle2' });
                console.log("Heartbeat: Session refreshed.");
            } catch (e) {
                console.log("Refresh failed, retrying in 5 mins.");
            }
        }, 5 * 60 * 1000);

    } catch (err) {
        console.error("LAUNCH ERROR:", err.message);
        console.log("Trying fallback path...");
        // If the above fails, this is the last-resort path for Puppeteer images
        try {
            const browserFallback = await puppeteer.launch({
                headless: "new",
                executablePath: '/home/pptruser/.cache/puppeteer/chrome/linux-119.0.6045.105/chrome-linux/chrome',
                args: ['--no-sandbox']
            });
            console.log("Fallback SUCCESS.");
        } catch (e) {
            console.error("All paths failed.");
        }
    }
}

startBrowser();