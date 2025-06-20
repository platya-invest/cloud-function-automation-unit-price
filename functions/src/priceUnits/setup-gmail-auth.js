/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
const {google} = require("googleapis");
const fs = require("fs");
const readline = require("readline");

// Gmail authentication configuration
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = "./token.json";
const CREDENTIALS_PATH = "./credentials.json";

async function setupGmailAuth() {
  console.log("🔧 Setting up Gmail authentication...\n");

  // Step 1: Verify that credentials.json exists
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("❌ credentials.json file not found");
    console.log("\n📋 Steps to get credentials.json:");
    console.log("1. Go to https://console.cloud.google.com/");
    console.log("2. Create a new project or select an existing one");
    console.log("3. Enable the Gmail API");
    console.log("4. Go to \"APIs and services\" > \"Credentials\"");
    console.log("5. Click \"Create credentials\" > \"OAuth 2.0 Client ID\"");
    console.log("6. Select \"Desktop application\"");
    console.log("7. Download the JSON file and rename it as \"credentials.json\"");
    console.log("8. Place it in this folder and run this script again\n");
    return;
  }

  try {
    // Step 2: Load credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const {client_secret, client_id, redirect_uris} = credentials.web || credentials.installed;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Step 3: Check if valid token already exists
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);

        // Check if token is still valid
        const gmail = google.gmail({version: "v1", auth: oAuth2Client});
        await gmail.users.getProfile({userId: "me"});

        console.log("✅ You already have a valid authentication configured");
        console.log("✅ You can execute: npm start");
        return;
      } catch (error) {
        console.log("⚠️  Existing token not valid, generating a new one...");
        fs.unlinkSync(TOKEN_PATH);
      }
    }

    // Step 4: Generate new authorization
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    console.log("🌐 Open this URL in your browser to authorize the application:");
    console.log("\n" + authUrl + "\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("📝 Paste here the code you get after authorizing: ", async (code) => {
      rl.close();

      try {
        const {tokens} = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save the token
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        console.log("\n✅ Token saved successfully to:", TOKEN_PATH);
        console.log("✅ Configuration completed");
        console.log("✅ You can now execute: npm start\n");

        // Verify it works
        const gmail = google.gmail({version: "v1", auth: oAuth2Client});
        const profile = await gmail.users.getProfile({userId: "me"});
        console.log(`📧 Connected as: ${profile.data.emailAddress}`);
      } catch (error) {
        console.error("❌ Error getting token:", error.message);
        console.log("\n🔄 Try running this script again");
      }
    });
  } catch (error) {
    console.error("❌ Error reading credentials.json:", error.message);
    console.log("💡 Verify that the file has the correct JSON format");
  }
}

// Execute configuration
setupGmailAuth();
