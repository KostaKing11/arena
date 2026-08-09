/* Firebase config za projekat "igre-gladi-irl".

   Napomena za ubuduće: iz Firebase konzole se kopira snippet koji počinje sa
   `import ... from "firebase/app"` i završava sa `initializeApp(...)`.
   Ovde ide SAMO objekat sa vrednostima, pod imenom FIREBASE_CONFIG —
   `import` bi u običnom <script>-u srušio ceo fajl, a initializeApp
   pozivamo sami u net-firebase.js.

   Ovi ključevi nisu tajna — Firebase ih po dizajnu šalje browseru.
   Bazu štite pravila iz firebase-rules.json. */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBle8kXFfhNfpBxs6akR4735q5fMrMj1j8",
  authDomain: "igre-gladi-irl.firebaseapp.com",
  databaseURL: "https://igre-gladi-irl-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "igre-gladi-irl",
  storageBucket: "igre-gladi-irl.firebasestorage.app",
  messagingSenderId: "219912875874",
  appId: "1:219912875874:web:e8832a1769a181f8a5463b",
};
