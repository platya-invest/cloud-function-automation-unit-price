const firebaseConfig = require("./firebase-config");

// Usar la configuración centralizada de Firebase
const db = firebaseConfig.getFirestore();

/**
 * Guarda datos en Firebase
 * @param {Object[]} fondosData - Array de fondos a guardar
 */
async function saveToFirebase(fondosData) {
  try {
    const envInfo = firebaseConfig.getEnvironmentInfo();
    console.log(`🔥 Conectando a Firebase entorno: ${envInfo.environment}`);
    console.log(`📄 Base de datos: ${envInfo.databaseId}`);

    const priceUnitsRef = db.collection("priceUnits");
    const fundsRef = db.collection("funds");
    console.log("🔥 Guardando datos en Firebase...");

    if (!Array.isArray(fondosData) || fondosData.length === 0) {
      console.log("⚠️  No hay datos de fondos para guardar");
      return;
    }

    let savedCount = 0;
    let errorCount = 0;

    for (const fondo of fondosData) {
      try {
        const {idFund, date, price} = fondo;

        if (!idFund || !date || price === undefined) {
          console.log(`⚠️  Datos incompletos para fondo:`, fondo);
          errorCount++;
          continue;
        }
        const fundDoc = await fundsRef.doc(idFund).get();
        if (!fundDoc.exists) {
          console.log(`⚠️  Fondo no encontrado: ${idFund}`);
          errorCount++;
          continue;
        }
        await fundDoc.ref.update({
          unit: price,
        });
        const docRef = priceUnitsRef
            .doc(idFund)
            .collection("historical")
            .doc(date);

        const data = {
          date: date,
          price: price,
        };

        await docRef.set(data, {merge: true});

        console.log(`✅ Guardado: testGmail/${idFund}/historical/${date} - Precio: ${price}`);
        savedCount++;
      } catch (error) {
        console.error(`❌ Error al guardar fondo ${fondo.idFund}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen de guardado:`);
    console.log(`   ✅ Fondos guardados exitosamente: ${savedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📈 Total procesados: ${fondosData.length}`);
    console.log(`   🌍 Entorno: ${envInfo.environment} (${envInfo.databaseId})`);

    if (savedCount > 0) {
      console.log("🔥 Datos guardados exitosamente en Firebase");
    }
  } catch (error) {
    console.error("❌ Error general al guardar en Firebase:", error);
    throw error;
  }
}

module.exports = {saveToFirebase};
