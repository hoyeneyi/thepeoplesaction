// Site configuration. This is the ONLY file you need to edit to connect the live
// calendar, editable page text, contact inbox and admin portal to Firebase.
//
// 1. Create a Firebase project (see docs/ADMIN-GUIDE.md, "One-time setup").
// 2. Paste the web app config object below in place of `null`.
// 3. Deploy firebase/firestore.rules.
//
// While FIREBASE_CONFIG is null the public site still works: it reads the static
// files in /assets/data/ and the contact form falls back to opening an email.

export const FIREBASE_CONFIG = null;
/* Example:
export const FIREBASE_CONFIG = {
  apiKey: "…",
  authDomain: "thepeoplesaction-site.firebaseapp.com",
  projectId: "thepeoplesaction-site",
  storageBucket: "thepeoplesaction-site.appspot.com",
  messagingSenderId: "…",
  appId: "…"
};
*/

// Firebase Storage (photo uploads from the admin portal) needs the Blaze plan on new
// Firebase projects. Leave false to paste image links instead of uploading.
export const STORAGE_ENABLED = false;

// Organization contact + PayPal donation recipient (taken from the existing site's
// PayPal button: "Make a donation to info@thepeoplesaction.com for The Peoples Action").
export const CONTACT_EMAIL = 'info@thepeoplesaction.com';
export const PAYPAL_BUSINESS = 'info@thepeoplesaction.com';
export const ORG_NAME = 'The Peoples Action';

export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
