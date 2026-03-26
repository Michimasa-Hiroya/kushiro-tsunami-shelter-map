// Firebase 設定ファイル（このファイルは .gitignore で除外されています）
// 本番環境用の実際の値を入力してください。
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBDv0nKx4yT7Nkebakb6al1Au2x7sL3588",
  authDomain:        "kushiro-shelter.firebaseapp.com",
  projectId:         "kushiro-shelter",
  storageBucket:     "kushiro-shelter.firebasestorage.app",
  messagingSenderId: "511578893397",
  appId:             "1:511578893397:web:5d5995312f5ed023c438dc",
};

if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.projectId) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
