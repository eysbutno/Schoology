// --- Constants ---
const GITHUB_TOKEN = Keychain.get("GITHUB_TOKEN");
const OWNER = "eysbutno";
const REPO = "Schoology";
const FILEPATH = "grades.json";

const TITLE_FONT = 16;
const NORMAL_FONT = 13;
const SMALL_FONT = 10;

// --- Helper Functions ---
const grade_color = (grade) => {
  const letter = grade[0];
  if (letter === "A") return Color.green();
  if (letter === "B") return Color.yellow();
  if (letter === "C") return Color.orange();
  return Color.red();
};

const time_elapsed = (diff) => {
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const recent_upd = days <= 1;

  if (days >= 1) return { upd_text: `${days} ${days === 1 ? "day" : "days"} ago`, recent_upd };
  if (hours >= 1) return { upd_text: `${hours} ${hours === 1 ? "hour" : "hours"} ago`, recent_upd };
  if (minutes >= 1) return { upd_text: `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`, recent_upd };

  return { upd_text: `${seconds} ${seconds === 1 ? "second" : "seconds"} ago`, recent_upd };
};

const format_grade = (grade) => {
  const score_match = grade.match(/\d+(\.\d+)?/);
  const score = score_match ? parseFloat(score_match[0]) : null;

  const letter_match = grade.match(/\b[A-F][+-]?/i);
  let letter = letter_match ? letter_match[0].toUpperCase() : null;

  if (score === null) return grade;

  if (!letter) {
    if (score >= 97) letter = "A+";
    else if (score >= 93) letter = "A";
    else if (score >= 90) letter = "A-";
    else if (score >= 87) letter = "B+";
    else if (score >= 83) letter = "B";
    else if (score >= 80) letter = "B-";
    else if (score >= 77) letter = "C+";
    else if (score >= 73) letter = "C";
    else if (score >= 70) letter = "C-";
    else if (score >= 67) letter = "D+";
    else if (score >= 63) letter = "D";
    else if (score >= 60) letter = "D-";
    else letter = "F";
  }

  return `${letter} (${score}%)`;
};

const fm = FileManager.local();
const data_dir = fm.joinPath(fm.documentsDirectory(), ".cache");
if (!fm.fileExists(data_dir)) fm.createDirectory(data_dir);

// --- Load Grades ---
async function load_grades() {
  const data_path = fm.joinPath(data_dir, "grades_cache.json");

  try {
    const api_req = new Request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILEPATH}`);
    api_req.headers = { "Authorization": `token ${GITHUB_TOKEN}`, "User-Agent": "Scriptable" };
    const api_res = await api_req.loadJSON();

    const raw_req = new Request(api_res.download_url);
    raw_req.headers = { "Authorization": `token ${GITHUB_TOKEN}`, "User-Agent": "Scriptable" };
    const grades = await raw_req.loadJSON();

    fm.writeString(data_path, JSON.stringify(grades));
    return grades;
  } catch (e) {
    if (fm.fileExists(data_path)) return JSON.parse(fm.readString(data_path));
    throw new Error("No data available online or locally.");
  }
}

// --- Load Previous Notifs --- 
const notifs_path = fm.joinPath(data_dir, "notifs_cache.json");
let notifs_cache = null;
if (fm.fileExists(notifs_path)) {
  notifs_cache = JSON.parse(fm.readString(notifs_path));
}

const grades_json = await load_grades();
const grades = grades_json.courses;
const notifs = grades_json.updates;
const last_upd = grades_json.last_pulled;
const new_upd = [];

for (const upd_obj of notifs) {
  const { value, time } = upd_obj;
  const { name, awarded, maximum, course_id } = value;
  const DAY = 24 * 60 * 60 * 1000;
  const loc = notifs_cache?.find(c => JSON.stringify(c.value) === JSON.stringify(value));
  if (loc && time - loc.time <= DAY) {
    new_upd.push(loc);
    continue;
  }

  new_upd.push(upd_obj);

  const pct = (awarded / maximum) * 100;
  const p = pct.toFixed(1);

  const n = new Notification();
  n.title = "New Grade Posted";
  n.subtitle = name;
  n.body = `${awarded} / ${maximum} (${p}%)`;
  n.sound = "default";
  n.threadIdentifier = "grades";
  n.openURL = `schoology://course/${course_id}`;

  n.schedule();
}

fm.writeString(notifs_path, JSON.stringify(new_upd));

// --- Main Widget ---
const widget = new ListWidget();
widget.setPadding(15, 15, 15, 15);
widget.addSpacer(15);

const title = widget.addText("📚 Grades");
title.font = Font.boldSystemFont(TITLE_FONT);
title.textColor = Color.dynamic(Color.black(), Color.white());
widget.addSpacer(8);

for (const grade_obj of grades) {
  const row_stack = widget.addStack();
  row_stack.layoutHorizontally();

  const course_stack = row_stack.addStack();
  course_stack.size = new Size(125, NORMAL_FONT + 3);
  const course_text = course_stack.addText(grade_obj.name);
  course_text.font = Font.mediumSystemFont(NORMAL_FONT);
  course_text.textColor = Color.dynamic(Color.darkGray(), Color.lightGray());
  course_text.leftAlignText();
  course_stack.addSpacer();

  const grade_stack = row_stack.addStack();
  grade_stack.size = new Size(80, NORMAL_FONT + 3);
  const grade_value = format_grade(grade_obj.grade);
  const grade_text = grade_stack.addText(grade_value);
  grade_text.font = Font.mediumSystemFont(NORMAL_FONT);
  grade_text.textColor = grade_color(grade_value);
  grade_text.rightAlignText();
  grade_stack.addSpacer();

  row_stack.addSpacer();

  const update_stack = row_stack.addStack();
  const { upd_text, recent_upd } = time_elapsed(Date.now() - grade_obj.update);
  const update_text = update_stack.addText(upd_text);
  update_text.font = Font.mediumSystemFont(NORMAL_FONT);
  update_text.textColor = recent_upd ? Color.green() : Color.dynamic(Color.darkGray(), Color.lightGray());

  widget.addSpacer();
}

const last_row = widget.addStack();
last_row.layoutHorizontally();
last_row.addSpacer();
const { upd_text: last_upd_text, recent_upd: last_recent } = time_elapsed(Date.now() - last_upd);
const last_text = last_row.addText(`Last Update: ${last_upd_text}`);
last_text.font = Font.systemFont(SMALL_FONT);
last_text.textColor = last_recent ? Color.green() : Color.dynamic(Color.darkGray(), Color.lightGray());

widget.addSpacer(15);

widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
Script.setWidget(widget);
widget.presentMedium();
Script.complete();
