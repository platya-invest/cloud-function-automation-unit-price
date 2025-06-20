/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
const {google} = require("googleapis");
const fs = require("fs");
const readline = require("readline");

// Configuración de autenticación de Gmail
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = "./token.json";
const CREDENTIALS_PATH = "./credentials.json";

async function setupGmailAuth() {
  console.log("🔧 Configurando autenticación de Gmail...\n");

  // Paso 1: Verificar que existe credentials.json
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("❌ No se encontró el archivo credentials.json");
    console.log("\n📋 Pasos para obtener credentials.json:");
    console.log("1. Ve a https://console.cloud.google.com/");
    console.log("2. Crea un proyecto nuevo o selecciona uno existente");
    console.log("3. Habilita la Gmail API");
    console.log("4. Ve a \"APIs y servicios\" > \"Credenciales\"");
    console.log("5. Clic en \"Crear credenciales\" > \"ID de cliente OAuth 2.0\"");
    console.log("6. Selecciona \"Aplicación de escritorio\"");
    console.log("7. Descarga el archivo JSON y renómbralo como \"credentials.json\"");
    console.log("8. Colócalo en esta carpeta y ejecuta este script nuevamente\n");
    return;
  }

  try {
    // Paso 2: Cargar credenciales
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const {client_secret, client_id, redirect_uris} = credentials.web || credentials.installed;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Paso 3: Verificar si ya existe token válido
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);

        // Verificar si el token sigue siendo válido
        const gmail = google.gmail({version: "v1", auth: oAuth2Client});
        await gmail.users.getProfile({userId: "me"});

        console.log("✅ Ya tienes una autenticación válida configurada");
        console.log("✅ Puedes ejecutar: npm start");
        return;
      } catch (error) {
        console.log("⚠️  Token existente no válido, generando uno nuevo...");
        fs.unlinkSync(TOKEN_PATH);
      }
    }

    // Paso 4: Generar nueva autorización
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    console.log("🌐 Abre esta URL en tu navegador para autorizar la aplicación:");
    console.log("\n" + authUrl + "\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("📝 Pega aquí el código que obtienes después de autorizar: ", async (code) => {
      rl.close();

      try {
        const {tokens} = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Guardar el token
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        console.log("\n✅ Token guardado exitosamente en:", TOKEN_PATH);
        console.log("✅ Configuración completada");
        console.log("✅ Ya puedes ejecutar: npm start\n");

        // Verificar que funciona
        const gmail = google.gmail({version: "v1", auth: oAuth2Client});
        const profile = await gmail.users.getProfile({userId: "me"});
        console.log(`📧 Conectado como: ${profile.data.emailAddress}`);
      } catch (error) {
        console.error("❌ Error al obtener token:", error.message);
        console.log("\n🔄 Intenta ejecutar este script nuevamente");
      }
    });
  } catch (error) {
    console.error("❌ Error al leer credentials.json:", error.message);
    console.log("💡 Verifica que el archivo tenga el formato JSON correcto");
  }
}

// Ejecutar configuración
setupGmailAuth();
