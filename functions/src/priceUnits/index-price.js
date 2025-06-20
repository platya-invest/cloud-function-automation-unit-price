const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
const GmailPDFProcessor = require("./gmail-pdf-processor");

// Cloud Function HTTP to execute manually
exports.getPriceUnits = onRequest(async (_, response) => {
  try {
    logger.info("🔧 Starting manual fund processing...");
    const gmailPDFProcessor = new GmailPDFProcessor();
    const result = await gmailPDFProcessor.processDaily();

    logger.info("✅ Manual processing completed:", result);
    response.status(200).json({
      success: true,
      message: "Daily processing completed successfully",
      data: result,
    });
  } catch (error) {
    logger.error("❌ Error in manual processing:", error.message);
    response.status(500).json({
      success: false,
      message: "There was a problem processing the emails",
      error: error.message,
    });
  }
});

// Scheduled Cloud Function to execute every day at 10:00 AM Colombia time (UTC-5)
exports.processPriceUnits = onSchedule({
  schedule: "0 15 * * *", // 10:00 AM Colombia time (UTC-5)
  timeZone: "America/Bogota",
  memory: "1GiB",
  timeoutSeconds: 540, // 9 minutes
}, async (event) => {
  logger.info("🕙 Starting scheduled fund processing...");

  try {
    const processor = new GmailPDFProcessor();
    const result = await processor.processDaily();

    logger.info("✅ Scheduled processing completed:", result);
    return result;
  } catch (error) {
    logger.error("❌ Error in scheduled processing:", error.message);
    throw error;
  }
});
