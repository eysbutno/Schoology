import fs from 'fs'
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const base_url = 'https://fuhsd.schoology.com';
const state_path = './state.json';
const grade_path = './grades.json';

(async () => {
  const email = "jji882@student.fuhsd.org"; // process.env.GOOGLE_USER;
  const password = "WSB&hE77$obqX9mA"; // process.env.GOOGLE_PASS;

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

      await page.waitForLoadState('networkidle');
      
      if (page.url().includes("accounts.google.com")) {
        // fill password
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.fill('input[type="password"]', password);
        await page.locator('#passwordNext').click();
        
        // wait until back on Schoology
        await page.waitForURL(`${base_url}/grades/grades`, { timeout: 30000 });
      }

      // save session for next run
      await context.storageState({ path: state_path });
      console.log("Logged in and saved session state.");
    } else {
      console.log("Already logged in, using existing session.");
    }

    type Entry = { name: string; awarded: number; maximum: number; course_id: number }
    type Course = { name: string; course_id: number; grade: string; update: number; assignments: Entry[] | null };

    let prev_grades: Course[] | null = null;
    if (fs.existsSync(grade_path)) {
      try {
        const data = fs.readFileSync(grade_path, 'utf-8');
        if (data.trim().length > 0) {
          prev_grades = JSON.parse(data).courses;
          console.log("Loaded previous grades:", prev_grades);
        }
      } catch (err) { 
        console.error("Error reading or parsing grades.json", err);
      }
    }

    const loc = page.locator(".gradebook-course.hierarchical-grading-report");
    const raw_courses = await loc.evaluateAll((elements) => {
        return elements.map((element) => {
            const name = element.querySelector("span.arrow")?.nextSibling?.textContent ?? "";
            const grade = element.querySelector(".course-grade-value")?.textContent?.trim() ?? "";
            const cleaned_name = name.split(" - ")[0]; // keep text before dash
            const course_id = parseInt(element.id.split("-").at(-1) ?? "");
            const assignments = Array.from(element.querySelectorAll(".report-row.item-row")).map(cur => {
                const name = ((cur.querySelector(".sExtlink-processed")?.childNodes[0]?.textContent) ?? "").trim();
                let span = cur.querySelector("span.awarded-grade");
                if (span == null) {
                    return {name, awarded: 0, maximum: 0, course_id};
                } else {
                    while (span?.querySelector("span") != null) {
                        span = span?.querySelector("span");
                    }
                }

                let awarded = 0;
                let maximum = 0;
                const num = parseFloat(span?.textContent ?? "");

                if (!isNaN(num)) {
                    awarded = num;

                    const max_span = cur.querySelector("span.max-grade");
                    if (max_span) {
                        maximum = parseFloat(max_span?.textContent.split(" ").at(-1) ?? "");
                    }
                } 

                return {name, awarded, maximum, course_id};
            });

            return { name: cleaned_name, course_id, grade, assignments };
        }).filter(course => course.grade !== "N/A");
    });

    const courses: Course[] = [];
    const updates: Entry[] = [];
    raw_courses.forEach((course) => {
        const loc = prev_grades?.find(c => c.course_id === course.course_id);
        if (prev_grades && loc) {
            let need_upd = false;
            course.assignments.forEach(assignment => {
                const prev = loc.assignments?.find(c => c.name === assignment.name);
                if (!prev || (prev.awarded !== assignment.awarded || prev.maximum !== assignment.maximum)) {
                    updates.push(assignment);
                    need_upd = true;
                }
            });

            courses.push({ name: course.name, course_id: course.course_id, grade: course.grade, update: need_upd ? Date.now() : loc.update, assignments: course.assignments });
        } else {
            courses.push({ name: course.name, course_id: course.course_id, grade: course.grade, update: Date.now(), assignments: course.assignments });
        }
    })

    const output = {
      last_pulled: Date.now(),
      courses,
      updates
    };

    console.log("Courses & Grades:", output);

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
