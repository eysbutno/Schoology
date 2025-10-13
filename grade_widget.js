// Code is for Scriptable widgets, so it doesn't really work in Node
// So far, this just fetches all the grades... will have to code the UI later. 

const GITHUB_TOKEN = Keychain.get("GITHUB_TOKEN");
const OWNER = "eysbutno";
const REPO = "Schoology";
const FILEPATH = "grades.json";

const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILEPATH}`;

async function load_grades() {
  const fm = FileManager.local();
  const data_dir = fm.joinPath(fm.documentsDirectory(), ".cache");
  if (!fm.fileExists(data_dir)) fm.createDirectory(data_dir);

  const data_path = fm.joinPath(data_dir, "grades_cache.json");

  try {
    let api_req = new Request(url);
    api_req.headers = {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "User-Agent": "Scriptable"
    };

    let api_res = await api_req.loadJSON();

    let raw_req = new Request(api_res.download_url);
    raw_req.headers = {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "User-Agent": "Scriptable"
    };

    let grades = await raw_req.loadJSON();
    fm.writeString(data_path, JSON.stringify(grades));
    return grades;
  } catch (e) {
    if (fm.fileExists(data_path)) {
      const grades = JSON.parse(fm.readString(data_path));
      return grades;
    } else {
      throw new Error("No data available online or locally.");
    }
  }
}

const grades = await load_grades();

let widget = new ListWidget();
widget.setPadding(15, 15, 15, 15);

let title = widget.addText("📚 Grades");
title.font = Font.boldSystemFont(16);
title.textColor = Color.dynamic(Color.black(), Color.white());
widget.addSpacer(8);

function grade_color(grade) {
  let letter = grade[0];
  if (letter == "A") return Color.green();
  if (letter == "B") return Color.yellow();
  if (letter == "C") return Color.orange();
  return Color.red();
};

for (let [i, grade] of grades.entries()) {
  let row_stack = widget.addStack();
  row_stack.layoutHorizontally();

  let course = row_stack.addText(grade.name);
  course.font = Font.mediumSystemFont(13);
  course.textColor = Color.dynamic(Color.darkGray(), Color.lightGray());

  row_stack.addSpacer();

  let res = row_stack.addText(String(grade.grade));
  res.font = Font.mediumSystemFont(13);
  res.textColor = grade_color(grade.grade);

  if (i !== grades.length - 1) {
    widget.addSpacer();
  }
}

widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
Script.setWidget(widget);
widget.presentMedium();
Script.complete();
