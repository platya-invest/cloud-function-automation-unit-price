const firebaseConfig = require("./firebase-config");

// Use centralized Firebase configuration
const db = firebaseConfig.getFirestore();

/**
 * Saves data to Firebase
 * @param {Object[]} fundsData - Array of funds to save
 */
async function saveToFirebase(fundsData) {
  try {
    const envInfo = firebaseConfig.getEnvironmentInfo();
    console.log(`🔥 Connecting to Firebase environment: ${envInfo.environment}`);
    console.log(`📄 Database: ${envInfo.databaseId}`);

    const priceUnitsRef = db.collection("priceUnits");
    const fundsRef = db.collection("funds");
    console.log("🔥 Saving data to Firebase...");

    if (!Array.isArray(fundsData) || fundsData.length === 0) {
      console.log("⚠️  No fund data to save");
      return;
    }

    let savedCount = 0;
    let errorCount = 0;

    for (const fund of fundsData) {
      try {
        const {idFund, date, price} = fund;

        if (!idFund || !date || price === undefined) {
          console.log(`⚠️  Incomplete data for fund:`, fund);
          errorCount++;
          continue;
        }
        const fundDoc = await fundsRef.doc(idFund).get();
        if (!fundDoc.exists) {
          console.log(`⚠️  Fund not found: ${idFund}`);
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

        console.log(`✅ Saved: testGmail/${idFund}/historical/${date} - Price: ${price}`);
        savedCount++;
      } catch (error) {
        console.error(`❌ Error saving fund ${fund.idFund}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Save summary:`);
    console.log(`   ✅ Funds saved successfully: ${savedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📈 Total processed: ${fundsData.length}`);
    console.log(`   🌍 Environment: ${envInfo.environment} (${envInfo.databaseId})`);

    if (savedCount > 0) {
      console.log("🔥 Data saved successfully to Firebase");
    }
  } catch (error) {
    console.error("❌ General error saving to Firebase:", error);
    throw error;
  }
}

module.exports = {saveToFirebase};
