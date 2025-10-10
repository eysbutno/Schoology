// Code is for Scriptable widgets, so it doesn't really work in Node
// So far, this just fetches all the grades... will have to code the UI later. 

const GITHUB_TOKEN = Keychain.get("GITHUB_TOKEN")
const OWNER = "eysbutno"
const REPO = "Schoology"
const FILEPATH = "grades.json"

const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILEPATH}`

let api_req = new Request(url)
api_req.headers = {
  "Authorization": `token ${GITHUB_TOKEN}`,
  "User-Agent": "Scriptable"
}

let api_res = await api_req.loadJSON()

let raw_req = new Request(api_res.download_url)
raw_req.headers = {
  "Authorization": `token ${GITHUB_TOKEN}`,
  "User-Agent": "Scriptable"
}
let grades = await raw_req.loadJSON()

console.log(grades)