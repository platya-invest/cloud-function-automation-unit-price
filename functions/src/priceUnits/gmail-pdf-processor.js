require("dotenv").config();
const {google} = require("googleapis");
const fs = require("fs");
const OpenAIProcessor = require("./openai-processor");
const {saveToFirebase} = require("./save-firebase");

// Gmail authentication configuration
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = __dirname + "/token.json";
const CREDENTIALS_PATH = __dirname + "/credentials.json";

/**
 * Class to process emails with PDFs and save data to Firebase
 */
class GmailPDFProcessor {
  /**
   * Constructor for the GmailPDFProcessor class
   * Initializes the necessary properties for processing
   */
  constructor() {
    this.gmail = null;
    this.auth = null;
    this.openaiProcessor = new OpenAIProcessor();
  }

  /**
   * Sets up OAuth2 authentication with Gmail API
   * @return {Promise<void>}
   */
  async authenticate() {
    try {
      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
      // eslint-disable-next-line camelcase
      const {client_secret, client_id, redirect_uris} = credentials.web || credentials.installed;

      // eslint-disable-next-line camelcase
      this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      // Try to load existing token
      try {
        const token = fs.readFileSync(TOKEN_PATH);
        this.auth.setCredentials(JSON.parse(token));
      } catch (err) {
        console.log("No existing token found. You need to authenticate.");
        await this.getNewToken();
      }

      this.gmail = google.gmail({version: "v1", auth: this.auth});
      console.log("✅ Successful authentication with Gmail API");
    } catch (error) {
      console.error("❌ Authentication error:", error.message);
      throw error;
    }
  }

  /**
   * Generates a new access token for OAuth2 authentication
   * @return {Promise<void>}
   */
  async getNewToken() {
    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    console.log("Authorize this application by visiting this URL:", authUrl);
    console.log("After authorizing, add the code to the token.json file manually");

    // In a production environment, you would implement automatic code capture here
    throw new Error("You need to complete OAuth2 authentication manually");
  }

  /**
   * Gets today's date in YYYY/MM/DD format
   * @return {string} Date in YYYY/MM/DD format
   */
  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  }

  /**
   * Searches for today's emails from specific sender and returns only the most recent one
   * @param {string} senderEmail - Sender's email
   * @return {Promise<Object[]>} Array with the most recent message found
   */
  async searchTodayEmails(senderEmail = "kennedyduque11@gmail.com") {
    try {
      const requiredSubject = "Valor diario de la unidad y rentabilidad fondos";

      // Query to search for emails from specific sender with specific subject (last 2 days to ensure we find the email)
      const query = `from:${senderEmail} newer_than:2d has:attachment filename:pdf subject:"${requiredSubject}"`;

      console.log(`🔍 Searching for recent emails from ${senderEmail} with PDF files...`);
      console.log(`📋 Required subject: "${requiredSubject}"`);

      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 10, // Limit to 10 most recent results
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} email(s) matching the criteria`);

      if (messages.length === 0) {
        return [];
      }

      // Only take the most recent email (Gmail returns results ordered by date, most recent first)
      const mostRecentMessage = messages[0];
      console.log(`📧 Processing only the most recent email: ID ${mostRecentMessage.id}`);

      return [mostRecentMessage];
    } catch (error) {
      console.error("❌ Error searching emails:", error.message);
      throw error;
    }
  }

  /**
   * Gets message details and downloads attached PDFs
   * @param {string} messageId - Message ID
   * @return {Promise<Object[]>} Array of downloaded PDF files
   */
  async downloadPDFsFromMessage(messageId) {
    try {
      console.log(`📥 Processing message ID: ${messageId}`);

      const message = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      const attachments = [];
      const parts = message.data.payload.parts || [message.data.payload];

      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith(".pdf")) {
          console.log(`📎 Found PDF file: ${part.filename}`);

          const attachment = await this.gmail.users.messages.attachments.get({
            userId: "me",
            messageId: messageId,
            id: part.body.attachmentId,
          });

          const data = attachment.data.data;
          const buffer = Buffer.from(data, "base64");

          console.log(`📎 PDF processed in memory: ${part.filename}`);

          attachments.push({
            filename: part.filename,
            buffer: buffer,
            size: buffer.length,
          });
        }
      }

      return attachments;
    } catch (error) {
      console.error("❌ Error downloading PDF:", error.message);
      throw error;
    }
  }

  /**
   * Processes a PDF with AI using OpenAI
   * @param {Object} attachment - Object with PDF file information
   * @param {string} attachment.filename - File name
   * @param {Buffer} attachment.buffer - Buffer with PDF content
   * @param {number} attachment.size - File size
   * @return {Promise<Object>} Processing result
   */
  async processPDFWithAI(attachment) {
    try {
      // Check if OpenAI is configured
      if (!process.env.OPENAI_API_KEY) {
        console.log("⚠️  OpenAI not configured. To use AI, configure OPENAI_API_KEY");
        console.log("💡 Execute: export OPENAI_API_KEY=your_api_key_here");

        return {
          message: "OpenAI not configured - PDF downloaded successfully",
          filepath: attachment.filepath,
          skipped_ai: true,
        };
      }

      // Process with OpenAI
      const result = await this.openaiProcessor.processPDF(attachment);
      return result;
    } catch (error) {
      console.error("❌ Error processing PDF with AI:", error.message);

      return {
        message: "Error in AI processing - PDF downloaded successfully",
        filepath: attachment.filepath,
        error: error.message,
        skipped_ai: true,
      };
    }
  }

  /**
   * Main function to process daily emails
   * @return {Promise<void>}
   */
  async processDaily() {
    try {
      console.log("🚀 Starting daily email processing...");

      await this.authenticate();

      const messages = await this.searchTodayEmails("kennedyduque11@gmail.com");

      if (messages.length === 0) {
        console.log("ℹ️  No emails found today with PDFs from the specified sender");
        return;
      }

      const allFundsData = [];

      for (const message of messages) {
        const attachments = await this.downloadPDFsFromMessage(message.id);

        for (const attachment of attachments) {
          const result = await this.processPDFWithAI(attachment);

          // If processing was successful and we have fund data
          if (result.success && result.extracted_funds && Array.isArray(result.extracted_funds)) {
            allFundsData.push(...result.extracted_funds);
          }
        }
      }

      // Save all data to Firebase
      if (allFundsData.length > 0) {
        console.log(`\n🔥 Saving ${allFundsData.length} fund records to Firebase...`);
        await saveToFirebase(allFundsData);
      } else {
        console.log("⚠️  No fund data found to save to Firebase");
      }

      console.log("✅ Processing completed successfully");
    } catch (error) {
      console.error("❌ Processing error:", error.message);
      throw error;
    }
  }
}

/**
 * Main function to execute the processor
 * @return {Promise<void>}
 */
async function main() {
  const processor = new GmailPDFProcessor();
  await processor.processDaily();
}

// Execute if this file is run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = GmailPDFProcessor;
