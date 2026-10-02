import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dump() {
  const querySnapshot = await getDocs(collection(db, 'settings'));
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

dump().catch(err => {
  console.error(err);
  process.exit(1);
});
