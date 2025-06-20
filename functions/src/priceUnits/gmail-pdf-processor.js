require("dotenv").config();
const {google} = require("googleapis");
const fs = require("fs");
const OpenAIProcessor = require("./openai-processor");
const {saveToFirebase} = require("./save-firebase");

// Configuración de autenticación de Gmail
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = __dirname + "/token.json";
const CREDENTIALS_PATH = __dirname + "/credentials.json";

/**
 * Clase para procesar emails con PDFs y guardar datos en Firebase
 */
class GmailPDFProcessor {
  /**
   * Constructor de la clase GmailPDFProcessor
   * Inicializa las propiedades necesarias para el procesamiento
   */
  constructor() {
    this.gmail = null;
    this.auth = null;
    this.openaiProcessor = new OpenAIProcessor();
  }

  /**
   * Configura la autenticación OAuth2 con Gmail API
   * @return {Promise<void>}
   */
  async authenticate() {
    try {
      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
      // eslint-disable-next-line camelcase
      const {client_secret, client_id, redirect_uris} = credentials.web || credentials.installed;

      // eslint-disable-next-line camelcase
      this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      // Intentar cargar token existente
      try {
        const token = fs.readFileSync(TOKEN_PATH);
        this.auth.setCredentials(JSON.parse(token));
      } catch (err) {
        console.log("No se encontró token existente. Necesitas autenticarte.");
        await this.getNewToken();
      }

      this.gmail = google.gmail({version: "v1", auth: this.auth});
      console.log("✅ Autenticación exitosa con Gmail API");
    } catch (error) {
      console.error("❌ Error en autenticación:", error.message);
      throw error;
    }
  }

  /**
   * Genera un nuevo token de acceso para la autenticación OAuth2
   * @return {Promise<void>}
   */
  async getNewToken() {
    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    console.log("Autoriza esta aplicación visitando esta URL:", authUrl);
    console.log("Después de autorizar, agrega el código en el archivo token.json manualmente");

    // En un entorno de producción, aquí implementarías la captura automática del código
    throw new Error("Necesitas completar la autenticación OAuth2 manualmente");
  }

  /**
   * Obtiene la fecha de hoy en formato YYYY/MM/DD
   * @return {string} Fecha en formato YYYY/MM/DD
   */
  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  }

  /**
   * Busca emails del día de hoy del remitente específico y retorna solo el más reciente
   * @param {string} senderEmail - Email del remitente
   * @return {Promise<Object[]>} Array con el mensaje más reciente encontrado
   */
  async searchTodayEmails(senderEmail = "kennedyduque11@gmail.com") {
    try {
      const requiredSubject = "Valor diario de la unidad y rentabilidad fondos";

      // Consulta para buscar emails del remitente específico con asunto específico (últimos 2 días para asegurar que encontremos el email)
      const query = `from:${senderEmail} newer_than:2d has:attachment filename:pdf subject:"${requiredSubject}"`;

      console.log(`🔍 Buscando emails recientes de ${senderEmail} con archivos PDF...`);
      console.log(`📋 Asunto requerido: "${requiredSubject}"`);

      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 10, // Limitar a 10 resultados más recientes
      });

      const messages = response.data.messages || [];
      console.log(`📧 Se encontraron ${messages.length} email(s) que coinciden con los criterios`);

      if (messages.length === 0) {
        return [];
      }

      // Solo tomar el email más reciente (Gmail devuelve los resultados ordenados por fecha, más reciente primero)
      const mostRecentMessage = messages[0];
      console.log(`📧 Procesando solo el email más reciente: ID ${mostRecentMessage.id}`);

      return [mostRecentMessage];
    } catch (error) {
      console.error("❌ Error al buscar emails:", error.message);
      throw error;
    }
  }

  /**
   * Obtiene detalles del mensaje y descarga los PDFs adjuntos
   * @param {string} messageId - ID del mensaje
   * @return {Promise<Object[]>} Array de archivos PDF descargados
   */
  async downloadPDFsFromMessage(messageId) {
    try {
      console.log(`📥 Procesando mensaje ID: ${messageId}`);

      const message = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      const attachments = [];
      const parts = message.data.payload.parts || [message.data.payload];

      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith(".pdf")) {
          console.log(`📎 Encontrado archivo PDF: ${part.filename}`);

          const attachment = await this.gmail.users.messages.attachments.get({
            userId: "me",
            messageId: messageId,
            id: part.body.attachmentId,
          });

          const data = attachment.data.data;
          const buffer = Buffer.from(data, "base64");

          console.log(`📎 PDF procesado en memoria: ${part.filename}`);

          attachments.push({
            filename: part.filename,
            buffer: buffer,
            size: buffer.length,
          });
        }
      }

      return attachments;
    } catch (error) {
      console.error("❌ Error al descargar PDF:", error.message);
      throw error;
    }
  }

  /**
   * Procesa un PDF con IA usando OpenAI
   * @param {Object} attachment - Objeto con información del archivo PDF
   * @param {string} attachment.filename - Nombre del archivo
   * @param {Buffer} attachment.buffer - Buffer con el contenido del PDF
   * @param {number} attachment.size - Tamaño del archivo
   * @return {Promise<Object>} Resultado del procesamiento
   */
  async processPDFWithAI(attachment) {
    try {
      // Verificar si OpenAI está configurado
      if (!process.env.OPENAI_API_KEY) {
        console.log("⚠️  OpenAI no configurado. Para usar IA, configura OPENAI_API_KEY");
        console.log("💡 Ejecuta: export OPENAI_API_KEY=tu_api_key_aqui");

        return {
          message: "OpenAI no configurado - PDF descargado exitosamente",
          filepath: attachment.filepath,
          skipped_ai: true,
        };
      }

      // Procesar con OpenAI
      const result = await this.openaiProcessor.processPDF(attachment);
      return result;
    } catch (error) {
      console.error("❌ Error al procesar PDF con IA:", error.message);

      return {
        message: "Error en procesamiento con IA - PDF descargado exitosamente",
        filepath: attachment.filepath,
        error: error.message,
        skipped_ai: true,
      };
    }
  }

  /**
   * Función principal para procesar emails diarios
   * @return {Promise<void>}
   */
  async processDaily() {
    try {
      console.log("🚀 Iniciando procesamiento diario de emails...");

      await this.authenticate();

      const messages = await this.searchTodayEmails("kennedyduque11@gmail.com");

      if (messages.length === 0) {
        console.log("ℹ️  No se encontraron emails de hoy con PDFs del remitente especificado");
        return;
      }

      const allFondosData = [];

      for (const message of messages) {
        const attachments = await this.downloadPDFsFromMessage(message.id);

        for (const attachment of attachments) {
          const result = await this.processPDFWithAI(attachment);

          // Si el procesamiento fue exitoso y tenemos datos de fondos
          if (result.success && result.fondos_extraidos && Array.isArray(result.fondos_extraidos)) {
            allFondosData.push(...result.fondos_extraidos);
          }
        }
      }

      // Guardar todos los datos en Firebase
      if (allFondosData.length > 0) {
        console.log(`\n🔥 Guardando ${allFondosData.length} registros de fondos en Firebase...`);
        await saveToFirebase(allFondosData);
      } else {
        console.log("⚠️  No se encontraron datos de fondos para guardar en Firebase");
      }

      console.log("✅ Procesamiento completado exitosamente");
    } catch (error) {
      console.error("❌ Error en el procesamiento:", error.message);
    }
  }
}

/**
 * Función principal para ejecutar el procesamiento diario
 * @return {Promise<void>}
 */
async function main() {
  const processor = new GmailPDFProcessor();
  await processor.processDaily();
}

if (require.main === module) {
  main();
}

module.exports = GmailPDFProcessor;
