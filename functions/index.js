/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Usar la configuración centralizada de Firebase
const firebaseConfig = require("./src/priceUnits/firebase-config");
firebaseConfig.initialize();

const priceUnits = require("./src/priceUnits/index-price");

exports.getPriceUnits = priceUnits.getPriceUnits;
exports.processPriceUnits = priceUnits.processPriceUnits;

