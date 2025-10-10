import fs from 'fs'
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const base_url = 'https://fuhsd.schoology.com';
const state_path = './state.json';

(async () => {
  const email = process.env.GOOGLE_USER;
  const password = process.env.GOOGLE_PASS;

  if (!email || !password) {
    console.error("Please set GOOGLE_USER and GOOGLE_PASS environment variables.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // only include storage_state if the file exists
  const context_options: any = { ignoreHTTPSErrors: true };

  if (fs.existsSync(state_path)) {
    try {
      const data = fs.readFileSync(state_path, 'utf-8');
      if (data.trim().length > 0) {
        context_options.storageState = state_path;
        console.log('Loaded existing storage state.');
      }
    } catch (err) {
      console.warn('Failed to read storage state, starting fresh.');
    }
  } else {
    console.log('No storage state found, starting fresh.');
  }

  const context = await browser.newContext(context_options);
  const page = await context.newPage();

  try {
    await page.goto(`${base_url}/grades/grades`, { waitUntil: 'networkidle' });

    // if redirected to Google login
    if (page.url().includes("accounts.google.com")) {
      console.log("Redirected to Google login, signing in...");

      const choose_account_exists = await page.locator('text=Choose an account').count() > 0;

      if (!choose_account_exists) {
        // fill email
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.fill('input[type="email"]', email);
        await page.locator('#identifierNext').click();
      } else {
        // click the correct email
        const used_selector = '[data-identifier="' + email + '"]';
        await page.locator(used_selector).click();
      }

      if (page.url().includes("accounts.google.com")) {
        // fill password
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.fill('input[type="password"]', password);
        await page.locator('#passwordNext').click();
      }
      
      // wait until back on Schoology
      await page.waitForURL(`${base_url}/grades/grades`, { timeout: 30000 });

      // save session for next run
      await context.storageState({ path: state_path });
      console.log("Logged in and saved session state.");
    } else {
      console.log("Already logged in, using existing session.");
    }

    // course names (text after <span class="arrow">)
    const course_names = await page.$$eval(".arrow", spans =>
      spans.map(span => {
        let node = span.nextSibling;
        return node?.textContent?.trim() ?? "";
      }).filter(Boolean)
    );

    // course grades
    const course_grades = await page.$$eval(".course-grade-value", elements =>
      elements.map(el => el.textContent?.trim())
    );

    // combine into objects
    const courses = course_names.map((name, i) => ({
      name: name.split(" - ")[0], // keep text before dash
      grade: course_grades[i] ?? "N/A"
    })).filter(course => course.grade !== "N/A");

    console.log("Courses & Grades:", courses);

    const user_json = JSON.stringify(courses);
    fs.writeFile('grades.json', user_json, (err) => {
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
