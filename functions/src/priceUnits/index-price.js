const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
const GmailPDFProcessor = require("./gmail-pdf-processor");

// Cloud Function HTTP para ejecutar manualmente
exports.getPriceUnits = onRequest(async (_, response) => {
  try {
    logger.info("🔧 Iniciando procesamiento manual de fondos...");
    const gmailPDFProcessor = new GmailPDFProcessor();
    const result = await gmailPDFProcessor.processDaily();

    logger.info("✅ Procesamiento manual completado:", result);
    response.status(200).json({
      success: true,
      message: "Procesamiento diario completado exitosamente",
      data: result,
    });
  } catch (error) {
    logger.error("❌ Error en procesamiento manual:", error.message);
    response.status(500).json({
      success: false,
      message: "Hubo un problema al procesar los emails",
      error: error.message,
    });
  }
});

// Cloud Function programada para ejecutarse todos los días a las 10:00 AM hora Colombia (UTC-5)
exports.processPriceUnits = onSchedule({
  schedule: "0 15 * * *", // 10:00 AM Colombia time (UTC-5)
  timeZone: "America/Bogota",
  memory: "1GiB",
  timeoutSeconds: 540, // 9 minutos
}, async (event) => {
  logger.info("🕙 Iniciando procesamiento programado de fondos...");

  try {
    const processor = new GmailPDFProcessor();
    const result = await processor.processDaily();

    logger.info("✅ Procesamiento programado completado:", result);
    return result;
  } catch (error) {
    logger.error("❌ Error en procesamiento programado:", error.message);
    throw error;
  }
});
