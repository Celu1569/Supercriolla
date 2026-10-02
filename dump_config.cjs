const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function dump() {
  const querySnapshot = await getDocs(collection(db, 'settings'));
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.general) {
      console.log("GENERAL SETTINGS:", JSON.stringify(data.general, null, 2));
    }
    if (data.appearance && data.appearance.radioPlayer) {
        console.log("PLAYER SETTINGS:", JSON.stringify(data.appearance.radioPlayer, null, 2));
    }
  });
  process.exit(0);
}

dump().catch(err => {
  console.error(err);
  process.exit(1);
});
