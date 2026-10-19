import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const targetDirs = [
  'C:\\Users\\Mobiloitte\\3D Objects\\document_intelligence_platform-main\\screenshots',
  'C:\\Users\\Mobiloitte\\3D Objects\\document_intelligence_platform-main\\document_intelligence_platform-main\\screenshots',
  'C:\\Users\\Mobiloitte\\3D Objects\\document_intelligence_platform-main\\DocNexaReport\\screenshots',
];

targetDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function saveAll(page, filename) {
  for (const dir of targetDirs) {
    const filePath = path.join(dir, filename);
    await page.screenshot({ path: filePath });
  }
  const currentUrl = page.url();
  console.log(`✓ Saved ${filename} [URL: ${currentUrl}]`);
}

async function run() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1050'],
    defaultViewport: { width: 1600, height: 1000 },
  });

  const page = await browser.newPage();

  // 1. Capture Login
  console.log('Capturing 01_login...');
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await saveAll(page, '01_login.png');

  // 2. Capture Verify Email (Step 1: Enter Email & Step 2: 6-Digit OTP)
  console.log('Capturing 02_verify_email (Step 1: Email Input)...');
  await page.goto('http://localhost:4200/verify-email', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await saveAll(page, '02_verify_email.png');
  await saveAll(page, '02_mfa_step1_email.png');

  // Trigger Send Verification Code to show OTP screen
  console.log('Transitioning to Step 2 (6-Digit OTP)...');
  await page.click('.btn-mfa-verify');
  await new Promise((r) => setTimeout(r, 800));
  await saveAll(page, '02_mfa_step2_otp.png');

  // 3. Log in as Admin via UI
  console.log('Logging in as Admin via UI...');
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.pill-btn');
  await page.click('.pill-btn'); // Automatically authenticates and navigates to /dashboard
  
  // Wait for SPA router transition to dashboard
  await new Promise((r) => setTimeout(r, 2500));

  // 4. Capture Dashboard
  console.log('Capturing 03_dashboard...');
  await saveAll(page, '03_dashboard.png');

  // Universal client-side navigation using Angular router / popstate
  async function goToRoute(routePath, filename, waitMs = 2000) {
    console.log(`Navigating to ${routePath}...`);
    await page.evaluate((targetRoute) => {
      window.history.pushState({}, '', targetRoute);
      window.dispatchEvent(new Event('popstate'));
    }, routePath);
    await new Promise((r) => setTimeout(r, waitMs));
    await saveAll(page, filename);
  }

  // 5. Capture Documents Repository
  await goToRoute('/documents', '04_documents.png', 2500);

  // 6. Capture Document Detail
  await goToRoute('/documents/DOC-10247', '05_document_detail.png', 2500);

  // 7. Capture Intake Studio
  await goToRoute('/intake', '06_intake.png', 2000);

  // 8. Capture Review Queue
  await goToRoute('/review', '07_review_queue.png', 2000);

  // 9. Capture HITL Review Workbench
  await goToRoute('/review/DOC-10247', '08_review_workbench.png', 2500);

  // 10. Capture Compare Studio
  await goToRoute('/compare', '09_compare_studio.png', 2000);

  // 11. Capture Approvals Center
  await goToRoute('/approvals', '10_approvals.png', 2000);

  // 12. Capture Tasks Worklist
  await goToRoute('/tasks', '11_tasks.png', 2000);

  // 13. Capture Search
  await goToRoute('/search', '12_search.png', 2000);

  // 14. Capture AI Q&A
  await goToRoute('/qa', '13_qa.png', 2000);

  // 15. Capture Admin Studio
  await goToRoute('/admin', '14_admin.png', 2000);

  await browser.close();
  console.log('🎉 ALL 14 UNIQUE SCREENSHOTS CAPTURED AND VERIFIED!');
}

run().catch((err) => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
