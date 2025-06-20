const admin = require("firebase-admin");

/**
 * Configuración centralizada para diferentes entornos de Firebase
 */
class FirebaseConfig {
  /**
   * Constructor de la clase FirebaseConfig
   */
  constructor() {
    this.environment = process.env.NODE_ENV || "qa";
    this.initialized = false;
  }

  /**
   * Inicializa Firebase Admin SDK según el entorno
   * @return {Object} Instancia de la aplicación Firebase
   */
  initialize() {
    if (this.initialized) {
      return admin.app();
    }

    try {
      let serviceAccount;
      let databaseId;

      switch (this.environment) {
        case "qa":
          serviceAccount = require("./platia-keycloak-firebase-adminsdk-ji2io-68a40b9313.json");
          databaseId = "mpfi-qa-firestore-db";
          break;

        case "production":
          serviceAccount = require("faltaLasCredencialesFirebase.json");
          databaseId = "faltaElIdDeLaBaseDeDatos";
          break;

        default:
          serviceAccount = require("./platia-keycloak-firebase-adminsdk-ji2io-68a40b9313.json");
          databaseId = "mpfi-qa-firestore-db";
          break;
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/`,
      });

      console.log(`🔥 Firebase inicializado para entorno: ${this.environment}`);
      console.log(`📄 Base de datos: ${databaseId}`);

      this.initialized = true;
      this.databaseId = databaseId;

      return admin.app();
    } catch (error) {
      console.error("❌ Error al inicializar Firebase:", error);
      throw error;
    }
  }

  /**
   * Obtiene la instancia de Firestore configurada para el entorno actual
   * @return {Object} Instancia de Firestore
   */
  getFirestore() {
    if (!this.initialized) {
      this.initialize();
    }

    const db = admin.firestore();

    if (this.databaseId && this.databaseId !== "(default)") {
      db.settings({
        databaseId: this.databaseId,
      });
    }

    return db;
  }

  /**
   * Obtiene la configuración del entorno actual
   * @return {Object} Información del entorno actual
   */
  getEnvironmentInfo() {
    return {
      environment: this.environment,
      databaseId: this.databaseId,
      initialized: this.initialized,
    };
  }
}

const firebaseConfig = new FirebaseConfig();

module.exports = firebaseConfig;
