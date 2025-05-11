/* firebase-init.js  ─ Firebase を初期化して window に公開 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDoc, setDoc,
  getDocs, doc, query, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

/* あなたの Firebase 設定値 */
const firebaseConfig = {
  apiKey: "AIzaSyCz8ZSNckbmrACW4cJqKx1I4GSQNyjDRkM",
  authDomain: "ikurakun-firebase.firebaseapp.com",
  projectId: "ikurakun-firebase",
  storageBucket: "ikurakun-firebase.appspot.com",
  messagingSenderId: "492357155886",
  appId: "1:492357155886:web:9a81837ea8361d2d0ef3bf"
};

/* 初期化 */
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

/* script.js から使えるようにまとめて window に載せる */
Object.assign(window, {
  db, auth,
  collection, addDoc, getDoc, setDoc,
  getDocs, doc, query, where, deleteDoc,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
});
