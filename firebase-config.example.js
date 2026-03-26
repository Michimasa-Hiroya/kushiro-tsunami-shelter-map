// Firebase 設定テンプレート
// このファイルをコピーして firebase-config.js を作成し、値を入力してください。
// firebase-config.js は .gitignore で除外されます（Gitには含めない）。
const FIREBASE_CONFIG = {
  apiKey:            "",   // Firebase Console → プロジェクト設定 → マイアプリ
  authDomain:        "",
  projectId:         "",   // 必須
  storageBucket:     "",
  messagingSenderId: "",
  appId:             "",
};

if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.projectId) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
