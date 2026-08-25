import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDABrDi0HQMtvaU5QSPtCn40LAw82U7XsU",
  authDomain: "fluentai-24a25.firebaseapp.com",
  projectId: "fluentai-24a25",
  storageBucket: "fluentai-24a25.firebasestorage.app",
  messagingSenderId: "1070965761605",
  appId: "1:1070965761605:web:c8b69e4ce257c1f8cfe52c",
  measurementId: "G-Y855E8TWMC",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
