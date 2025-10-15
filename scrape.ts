import fs from 'fs'
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const base_url = 'https://fuhsd.schoology.com';
const state_path = './state.json';
const grade_path = './grades.json';

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

    type Course = { name: string; grade: string; update: number };

    let prev_grades: Course[] | null = null;
    if (fs.existsSync(grade_path)) {
      try {
        const data = fs.readFileSync(grade_path, 'utf-8');
        if (data.trim().length > 0) {
          prev_grades = JSON.parse(data);
          console.log("Loaded previous grades:", prev_grades);
        }
      } catch (err) { 
        console.error("Error reading or parsing grades.json", err);
      }
    }

    // combine into objects
    const courses = course_names.map((name, i) => {
      const cleaned_name = name.split(" - ")[0]; // keep text before dash
      const grade = course_grades[i] ?? "N/A";

      // find previous entry by name
      const prev_course = prev_grades?.find(c => c.name === cleaned_name);
      const update = (prev_course && prev_course.grade === grade) 
        ? prev_course.update 
        : Date.now();

      return { name: cleaned_name, grade, update };
    }).filter(course => course.grade !== "N/A");

    console.log("Courses & Grades:", courses);

    const output = {
      last_pulled: Date.now(),
      courses
    };

    fs.writeFile('grades.json', JSON.stringify(output), (err) => {
      if (err) {
        console.log("Error writing file: ", err);
      } else {
        console.log("Successfully wrote file.")
      }
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
