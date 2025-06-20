const OpenAI = require("openai");

/**
 * Class to process PDFs using OpenAI API
 */
class OpenAIProcessor {
  /**
   * Constructor for the OpenAIProcessor class
   * Initializes the connection with OpenAI if the API key is configured
   */
  constructor() {
    this.openai = null;
    this.apiKeyConfigured = !!process.env.OPENAI_API_KEY;

    if (this.apiKeyConfigured) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Verifies if the API key is correctly configured
   * @throws {Error} If the API key is not configured
   */
  verifyAPIKey() {
    if (!this.apiKeyConfigured || !this.openai) {
      throw new Error("❌ Missing OPENAI_API_KEY configuration in environment variables. Execute: export OPENAI_API_KEY=your_api_key_here");
    }
  }

  /**
   * Processes a PDF file using OpenAI to extract fund information
   * @param {Object} attachment - Object with PDF file information
   * @param {string} attachment.filename - File name
   * @param {Buffer} attachment.buffer - Buffer with PDF content
   * @param {number} attachment.size - File size
   * @return {Promise<Object>} Processing result
   */
  async processPDF(attachment) {
    try {
      this.verifyAPIKey();

      console.log(`🤖 Processing PDF with OpenAI: ${attachment.filename}`);

      // Use the PDF buffer directly
      const base64PDF = attachment.buffer.toString("base64");

      // Custom prompt to extract specific fund data
      const prompt = `
Analiza este PDF que contiene una tabla de rentabilidad de fondos.

IMPORTANTE: Solo extrae los datos de estos 5 fondos específicos y devuelve ÚNICAMENTE un array JSON sin comentarios ni descripciones adicionales:

Fondos a buscar con sus IDs:
1. "FONDO DE INVERSION COLECTIVA ACCIVAL VISTA" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d9"
2. "FIC ACCICUENTA CONSERVADOR" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d8"
3. "FIC ACCICUENTA MODERADO" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d7"
4. "FIC ABIERTO ACCICUENTAMAYOR RIESGO" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d6"
5. "FONDO DE INVERSION COLECTIVA ACCIONES USA VOO" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d5"

Para cada fondo encontrado, extrae:
- La fecha del reporte (del título del documento)
- El valor de la unidad (segunda columna "Valor de la Unidad")

Devuelve SOLO este formato JSON (sin texto adicional):
[
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d9", "date": "2025-06-18", "price": 1234.54 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d8", "date": "2025-06-18", "price": 1234.5489 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d7", "date": "2025-06-18", "price": 123.54 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d6", "date": "2025-06-18", "price": 123.54777 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d5", "date": "2025-06-18", "price": 121231233.54 }
]

IMPORTANTE: 
- Usa los precios exactos de la columna "Valor de la Unidad"
- Usa la fecha exacta del título del documento
- Devuelve solo el array JSON, sin explicaciones
- Si un fondo no se encuentra, omítelo del array
`;

      const response = await this.openai.responses.create({
        model: "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: attachment.filename,
                file_data: `data:application/pdf;base64,${base64PDF}`,
              },
              {
                type: "input_text",
                text: prompt,
              },
            ],
          },
        ],
      });

      const extractedData = response.output_text.trim();

      console.log("📊 Data extracted by OpenAI:");
      console.log(extractedData);

      // Try to parse the JSON array
      let parsedData;
      try {
        // Clean the response in case it has additional text
        let cleanedData = extractedData;

        // If the response contains additional text, extract only the JSON array
        const jsonMatch = extractedData.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedData = jsonMatch[0];
        }

        parsedData = JSON.parse(cleanedData);

        // Verify it's an array
        if (!Array.isArray(parsedData)) {
          throw new Error("The response is not a valid array");
        }

        console.log(`✅ ${parsedData.length} funds processed successfully`);
      } catch (e) {
        console.log("⚠️  The response is not in valid JSON array format:", e.message);
        console.log("📄 Original response:", extractedData);
        parsedData = {
          error: "Invalid JSON format",
          raw_response: extractedData,
        };
      }

      // Return results directly without saving files
      const result = {
        success: true,
        original_file: attachment.filename,
        processing_date: new Date().toISOString(),
        extracted_funds: Array.isArray(parsedData) ? parsedData : null,
        total_funds_found: Array.isArray(parsedData) ? parsedData.length : 0,
        complete_analysis: parsedData,
        metadata: {
          file_size: attachment.size,
          model_used: "gpt-4.1",
          target_funds: 5,
        },
      };

      // Show summary of extracted funds
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        console.log("\n📋 Summary of extracted funds:");
        parsedData.forEach((fund, index) => {
          console.log(`${index + 1}. ID: ${fund.idFund}`);
          console.log(`   Date: ${fund.date}`);
          console.log(`   Price: ${fund.price}`);
          console.log("");
        });
      }

      return result;
    } catch (error) {
      console.error("❌ Error processing with OpenAI:", error.message);

      // Return an error result but don't fail completely
      return {
        success: false,
        error: error.message,
        original_file: attachment.filename,
      };
    }
  }

  /**
   * Processes multiple PDF files
   * @param {Object[]} attachments - Array of objects with PDF information
   * @return {Promise<Object[]>} Array with processing results
   */
  async processMultiplePDFs(attachments) {
    const results = [];

    for (const attachment of attachments) {
      const result = await this.processPDF(attachment);
      results.push(result);

      // Small pause between processing to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Tests the connection with OpenAI
   * @return {Promise<boolean>} true if connection is successful, false otherwise
   */
  async testConnection() {
    try {
      this.verifyAPIKey();

      const response = await this.openai.responses.create({
        model: "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Respond only: 'Connection successful'",
              },
            ],
          },
        ],
      });

      console.log("✅ Successful connection with OpenAI:", response.output_text);
      return true;
    } catch (error) {
      console.error("❌ Connection error with OpenAI:", error.message);
      return false;
    }
  }
}
module.exports = OpenAIProcessor;

