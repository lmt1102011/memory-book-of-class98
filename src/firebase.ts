import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCxCn9rXklHcVlW20NN3q4KAx5KhnnBoRM',
  authDomain: 'memorybook-of-class98.firebaseapp.com',
  projectId: 'memorybook-of-class98',
  storageBucket: 'memorybook-of-class98.firebasestorage.app',
  messagingSenderId: '661004126531',
  appId: '1:661004126531:web:5d3b394ef2e9839b7e87f6',
  measurementId: 'G-Q7EXKD9G7B',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true,
});
export const storage = getStorage(firebaseApp);
