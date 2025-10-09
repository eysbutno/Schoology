import fs from 'fs'
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const baseURL = 'https://fuhsd.schoology.com';
const statePath = './state.json';

(async () => {
  const email = process.env.GOOGLE_USER;
  const password = process.env.GOOGLE_PASS;

  if (!email || !password) {
    console.error("Please set GOOGLE_USER and GOOGLE_PASS environment variables.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // only include storageState if the file exists
  const contextOptions: any = { ignoreHTTPSErrors: true };

  if (fs.existsSync(statePath)) {
    try {
      const data = fs.readFileSync(statePath, 'utf-8');
      if (data.trim().length > 0) {
        contextOptions.storageState = statePath;
        console.log('Loaded existing storage state.');
      }
    } catch (err) {
      console.warn('Failed to read storage state, starting fresh.');
    }
  } else {
    console.log('No storage state found, starting fresh.');
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await page.goto(`${baseURL}/grades/grades`, { waitUntil: 'networkidle' });

    // if redirected to Google login
    if (page.url().includes("accounts.google.com")) {
      console.log("Redirected to Google login, signing in...");

      const chooseAccountExists = await page.locator('text=Choose an account').count() > 0;

      if (chooseAccountExists) {
        // fill email
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.fill('input[type="email"]', email);
        await page.locator('#identifierNext').click();
      } else {
        // click the correct email
        const usedSelector = '[data-identifier="' + email + '"]';
        await page.locator(usedSelector).click();
      }

      if (page.url().includes("accounts.google.com")) {
        // fill password
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.fill('input[type="password"]', password);
        await page.locator('#passwordNext').click();
      }
      
      // wait until back on Schoology
      await page.waitForURL(`${baseURL}/grades/grades`, { timeout: 30000 });

      // save session for next run
      await context.storageState({ path: statePath });
      console.log("Logged in and saved session state.");
    } else {
      console.log("Already logged in, using existing session.");
    }

    // course names (text after <span class="arrow">)
    const courseNames = await page.$$eval(".arrow", spans =>
      spans.map(span => {
        let node = span.nextSibling;
        return node?.textContent?.trim() ?? "";
      }).filter(Boolean)
    );

    // course grades
    const courseGrades = await page.$$eval(".course-grade-value", elements =>
      elements.map(el => el.textContent?.trim())
    );

    // combine into objects
    const courses = courseNames.map((name, i) => ({
      name: name.split(" - ")[0], // keep text before dash
      grade: courseGrades[i] ?? "N/A"
    })).filter(course => course.grade !== "N/A");

    console.log("Courses & Grades:", courses);

    const userJson = JSON.stringify(courses);
    fs.writeFile('grades.json', userJson, (err) => {
      if (err) {
        console.log("Error writing file: ", err);
      } else {
        console.log("Successfully wrote file.")
      }
    })
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
