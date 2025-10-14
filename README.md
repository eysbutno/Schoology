# What is this?

A scraper to automatically fetch Schoology grades, and display it in the form of a widget on my iPhone. My district uses Google's SSO, so automatically logging in is non-trivial.

The general setup is as follows:
- Use PlayWright and some other stuff to poll the grades hourly with GitHub Actions
  - Note: This code reuses logins as much as possible, mainly to avoid CAPTCHAs.
- Created a script to make a widget with the Scriptable app on the App Store

> [!IMPORTANT]
> This is somewhat risky! Do at your own risk.

# Setup

Clone this repository, and enter the login details as a secret in GitHub. Then, download Scriptable and copy paste the script from the repo into the app.

If you want to keep your GitHub repository private (as you probably should), then polling grades from GitHub is a bit trickier than it would be otherwise. The simplest solution is to get a Personal Access Token (PAT) from GitHub, and store it in your phone's KeyChain through Scriptable. Then, the widget can call GitHub's API to access and download the grades file. My current setup is done with a private repository, so the KeyChain stuff is handled for the most part. However, you will have to run a script to add your PAT to your KeyChain.
