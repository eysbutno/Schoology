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

// --- Load Grades ---
async function load_grades() {
  const fm = FileManager.local();
  const data_dir = fm.joinPath(fm.documentsDirectory(), ".cache");
  if (!fm.fileExists(data_dir)) fm.createDirectory(data_dir);

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

// --- Main Widget ---
const grades_json = await load_grades();
const grades = grades_json.courses;
const last_upd = grades_json.last_pulled;

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
  grade_stack.size = new Size(100, NORMAL_FONT + 3);
  const grade_text = grade_stack.addText(grade_obj.grade);
  grade_text.font = Font.mediumSystemFont(NORMAL_FONT);
  grade_text.textColor = grade_color(grade_obj.grade);
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
