/*
 * 1. Copy the Firebase web configuration from Firebase Console into this object.
 * 2. Replace ADMIN_UID with the UID of the one Google account allowed to edit.
 *
 * Firebase's web API key identifies the project; it is not a password. The
 * Firestore Security Rules in README.md are what protect write access.
 */
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

export const ADMIN_UID = "PASTE_YOUR_FIREBASE_AUTH_UID_HERE";
