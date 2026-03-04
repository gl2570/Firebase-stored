 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
  getDatabase,
  ref,
  off,
  onValue,
  update,
  set,
  push,
  onChildAdded,
  onChildChanged,
  onChildRemoved
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

let myObjectsByFirebaseKey = {};
let selectedObjectKey = null;
let ctx;
let db;
let auth;
let googleAuthProvider;
let currentUser = null;
let existingSubscribedFolder = null;
let exampleName = "SharedMindsExampleDragPictures";
initFirebaseDB();

let canvas;
let inputBox;
let currentObject = -1;
let mouseDown = false;
let promptWords = [];
initAuth();

function initAuth() {
  auth = getAuth();
  googleAuthProvider = new GoogleAuthProvider();
  buildLoginUI();
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      console.log("Logged in as", user.displayName || user.email, "UID:", user.uid);
      showApp(user);
    } else {
      currentUser = null;
      console.log("Not logged in");
      showLogin();
    }
  });
}

function buildLoginUI() {
  const loginDiv = document.createElement("div");
  loginDiv.id = "login-container";
  loginDiv.innerHTML = `
    <div class="login-card">
      <h1>Poster Generator</h1>
      <p class="login-subtitle">Sign in to start creating</p>
      <input type="email" id="email" placeholder="Email" autocomplete="email" />
      <input type="password" id="password" placeholder="Password" autocomplete="current-password" />
      <div class="login-buttons">
        <button id="btn-signin-email">Sign In</button>
        <button id="btn-signup-email" class="secondary">Sign Up</button>
      </div>
      <div class="login-divider"><span>or</span></div>
      <button id="btn-signin-google" class="google-btn">
        <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Sign in with Google
      </button>
      <p id="login-error" class="login-error"></p>
    </div>
  `;
  document.body.appendChild(loginDiv);

  document.getElementById("btn-signin-email").addEventListener("click", handleEmailSignIn);
  document.getElementById("btn-signup-email").addEventListener("click", handleEmailSignUp);
  document.getElementById("btn-signin-google").addEventListener("click", handleGoogleSignIn);

  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleEmailSignIn();
  });
}

function showLoginError(msg) {
  const el = document.getElementById("login-error");
  if (el) el.textContent = msg;
}

function handleGoogleSignIn() {
  showLoginError("");
  signInWithPopup(auth, googleAuthProvider)
    .then((result) => console.log("Google sign-in success", result.user.email))
    .catch((error) => {
      console.error("Google sign-in error", error);
      showLoginError(error.message);
    });
}

function handleEmailSignIn() {
  showLoginError("");
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  if (!email || !password) { showLoginError("Please enter email and password."); return; }
  signInWithEmailAndPassword(auth, email, password)
    .then((result) => console.log("Email sign-in success", result.user.email))
    .catch((error) => {
      console.error("Email sign-in error", error);
      showLoginError(error.message);
    });
}

function handleEmailSignUp() {
  showLoginError("");
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  if (!email || !password) { showLoginError("Please enter email and password."); return; }
  if (password.length < 6) { showLoginError("Password must be at least 6 characters."); return; }
  createUserWithEmailAndPassword(auth, email, password)
    .then((result) => console.log("Email sign-up success", result.user.email))
    .catch((error) => {
      console.error("Email sign-up error", error);
      showLoginError(error.message);
    });
}

function showLogin() {
  const loginEl = document.getElementById("login-container");
  const appEl = document.getElementById("app-container");
  if (loginEl) loginEl.style.display = "flex";
  if (appEl) appEl.style.display = "none";
}

function showApp(user) {
  const loginEl = document.getElementById("login-container");
  if (loginEl) loginEl.style.display = "none";

  let appEl = document.getElementById("app-container");
  if (!appEl) {
    appEl = document.createElement("div");
    appEl.id = "app-container";
    document.body.appendChild(appEl);
    initInterface();
    subscribeToData();
    animate();
  }
  appEl.style.display = "block";

  let userBar = document.getElementById("user-bar");
  if (!userBar) {
    userBar = document.createElement("div");
    userBar.id = "user-bar";
    document.body.appendChild(userBar);
  }
  const name = user.displayName || user.email;
  const photoHTML = user.photoURL
    ? `<img src="${user.photoURL}" class="user-avatar" referrerpolicy="no-referrer" />`
    : `<div class="user-avatar-placeholder">${(name || "?")[0].toUpperCase()}</div>`;
  userBar.innerHTML = `
    ${photoHTML}
    <span class="user-name">${name}</span>
    <button id="btn-signout">Sign Out</button>
  `;
  document.getElementById("btn-signout").addEventListener("click", () => {
    signOut(auth).catch((err) => console.error("Sign out error", err));
  });
}

function init() {
  initInterface();
  animate();
}
// Animate loop
function animate() {
  let ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let key in myObjectsByFirebaseKey) {
    let thisObject = myObjectsByFirebaseKey[key];
    if (thisObject.type === "image") {
      let position = thisObject.position;
      let img = thisObject.loadedImage;
      if (img) {
        ctx.fillColor = "black";
        ctx.font = "30px Arial";
        ctx.fillText(thisObject.prompt, position.x, position.y - 30);
        ctx.drawImage(img, position.x, position.y, 256, 256);
      }
    } else if (thisObject.type === "text") {
      let position = thisObject.position;
      ctx.font = "30px Arial";
      ctx.fillText(thisObject.text, position.x, position.y);
    }
  }
  requestAnimationFrame(animate);
}
async function askPictures(promptWord, location) {
  inputBox.value = 'Asking for ' + promptWord;
  document.body.style.cursor = "progress";
  let replicateProxy = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
  let authToken = "";
  //Optionally Get Auth Token from: https://itp-ima-replicate-proxy.web.app/
  let thisPromptWord = {
    word: promptWord,
    location: location,
  }
  promptWords.push(promptWord);
  document.body.style.cursor = "progress";
  const data = {
    model: "google/imagen-4-fast",
    input: {
      prompt: "keyword:" + promptWord +
        ",The following requirements apply: First, The image must contain only this keyword; no other words or elements are allowed. Second, the image background must be white. Third, The text font must be randomly select a comic/cartoon font.font colors should be colorful.- Thick black outlines around each letter - Vibrant, saturated gradient fills with halftone dot patterns- Comic book halftone texture overlay for retro printing effect- White outline/stroke around the outer edge of the text- Slightly irregular, hand-drawn letter shapes with dynamic angles- 3D effect with subtle depth and dimension- Energetic, explosive typography typical of vintage comic books- High contrast, punchy colors with comic book vibrancy Style: Pop art, vintage comic book, retro superhero aesthetics, 1960s comic printing style Colors: Saturated, vibrant comic book palette (let the model choose eye-catching combinations)。background must be white, no grey or other colors allowed. "
    },
  };
  console.log("Making a Fetch Request", data);
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  };
  const raw_response = await fetch(replicateProxy, options);
  //turn it into json
  const json_response = await raw_response.json();
  document.body.style.cursor = "auto";
  console.log("json_response", json_response);
  if (json_response.length == 0) {
    console.log("Something went wrong, try it again");
  } else {
    let img = document.createElement("img");
    //document.body.appendChild(img);
    img.style.position = 'absolute';
    img.style.left = location.x + 'px';
    img.style.top = location.y + 'px';
    img.style.width = '256px';
    img.style.height = '256px';
    img.src = json_response.output;
    addImageRemote(json_response.output, promptWord, {
      x: location.x,
      y: location.y
    });
    //don't add it locally, we will get it from firebase addChildAdded callback
  }
  document.body.style.cursor = "auto";
  inputBox.style.display = 'block';
  inputBox.value = '';
}

function initInterface() {
  // Get the input box and the canvas element
  canvas = document.createElement('canvas');
  canvas.setAttribute('id', 'myCanvas');
  canvas.style.position = 'absolute';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
  console.log('canvas', canvas.width, canvas.height);
  inputBox = document.createElement('input');
  inputBox.setAttribute('type', 'text');
  inputBox.setAttribute('id', 'inputBox');
  inputBox.setAttribute('placeholder', 'Enter text here');
  inputBox.style.position = 'absolute';
  inputBox.style.left = '50%';
  inputBox.style.top = '50%';
  inputBox.style.transform = 'translate(-50%, -50%)';
  inputBox.style.zIndex = '100';
  inputBox.style.fontSize = '30px';
  inputBox.style.fontFamily = 'Arial';
  document.body.appendChild(inputBox);
  inputBox.setAttribute('autocomplete', 'off');
  // Add event listener to the input box
  inputBox.addEventListener('keydown', function (event) {
    // Check if the Enter key is pressed
    if (event.key === 'Enter') {
      const inputValue = inputBox.value;
      var rect = inputBox.getBoundingClientRect()
      let location = {
        x: rect.left,
        y: rect.top
      };
      console.log("Location: ", location);
      askPictures(inputValue, location);
      //inputBox.style.display = 'none';
    }
  });
  // Add event listener to the document for mouse down event
  document.addEventListener('mousedown', (event) => {
    mouseDown = true;
    // Check if the mouse is clicked on any of the words
    currentObject = -1;
    for (let key in myObjectsByFirebaseKey) {
      let thisObject = myObjectsByFirebaseKey[key];
      //need to check if the mouse is over the object using the position and width and height
      if (event.clientX > thisObject.position.x && event.clientX < thisObject.position.x + 255 && event.clientY >
        thisObject.position.y && event.clientY < thisObject.position.y + 255) {
        currentObject = key;
        break;
      }
    }
    console.log("Clicked on ", currentObject);
  });
  document.addEventListener('mousemove', (event) => {
    //move words around
    if (mouseDown && currentObject != -1) {
      let thisLocation = {
        x: event.clientX,
        y: event.clientY
      };
      myObjectsByFirebaseKey[currentObject].position = thisLocation;
    }
  });
  document.addEventListener('mouseup', (event) => {
    if (currentObject != -1) {
      let thisLocation = myObjectsByFirebaseKey[currentObject].position;
      updateJSONFieldInFirebase(exampleName + "/" + currentObject + "/position/", {
        x: thisLocation.x,
        y: thisLocation.y
      });
    }
    mouseDown = false
  });
  // Add event listener to the document for double click event
  document.addEventListener('dblclick', (event) => {
    //ask for related words
    inputBox.style.display = 'block';
    inputBox.focus();
    inputBox.style.left = event.clientX + 'px';
    inputBox.style.top = event.clientY + 'px';
    console.log("Document double clicked");
  });
  // Add Snap button
  const snapButton = document.createElement('button');
  snapButton.textContent = 'Snap';
  snapButton.style.position = 'absolute';
  snapButton.style.top = '60px';
  snapButton.style.right = '10px';
  snapButton.style.zIndex = '100';
  snapButton.style.padding = '10px 20px';
  snapButton.style.fontSize = '16px';
  snapButton.style.cursor = 'pointer';
  document.body.appendChild(snapButton);
  snapButton.addEventListener('click', () => {
    const keys = Object.keys(myObjectsByFirebaseKey);
    const halfCount = Math.floor(keys.length / 2);
    const shuffled = keys.sort(() => Math.random() - 0.5);
    const toDelete = shuffled.slice(0, halfCount);
    for (let key of toDelete) {
      deleteFromFirebase(exampleName, key);
    }
    console.log(`Snapped ${toDelete.length} items out of existence`);
  });
}
///////////////////////FIREBASE///////////////////////////
export function addImageRemote(imgURL, prompt, pos) {
  console.log("addImageRemote", imgURL, prompt, pos);
  const data = {
    type: "image",
    prompt: prompt,
    position: pos,
    imageURL: imgURL,
    createdBy: currentUser ? currentUser.uid : "anonymous",
    createdByName: currentUser ? (currentUser.displayName || currentUser.email) : "anonymous"
  };
  let folder = exampleName + "/";
  console.log("Entered Image, Send to Firebase", folder, data);
  const key = addNewThingToFirebase(folder, data); //put empty for the key when you are making a new thing.
  return key;
}

function initFirebaseDB() {
  // Initialize Firebase
  const firebaseConfig = {
 apiKey: "AIzaSyCxWYLt3dkhSCZblBk2Iu9pBb5MILWOOMc",
    authDomain: "shared-minds-cf6ee.firebaseapp.com",
    projectId: "shared-minds-cf6ee",
    storageBucket: "shared-minds-cf6ee.firebasestorage.app",
    messagingSenderId: "194053399340",
    appId: "1:194053399340:web:2201140b7d943f3fb60289",
    measurementId: "G-GWHKDGCB93",
    databaseURL: "https://shared-minds-cf6ee-default-rtdb.firebaseio.com"
 
  };
  const app = initializeApp(firebaseConfig);
  db = getDatabase();
}

function addNewThingToFirebase(folder, data) {
  //firebase will supply the key,  this will trigger "onChildAdded" below
  const dbRef = ref(db, folder);
  const newKey = push(dbRef, data).key;
  return newKey; //useful for later updating
}
async function updateJSONFieldInFirebase(folder, data) {
  console.log("updateDataInFirebase", folder, data);
  const dbRef = ref(db, folder);
  try {
    await update(dbRef, data);
    // console.log("update ok");
  } catch (e) {
    console.error("update error", e);
  }
}

function setDataInFirebase(folder, data) {
  //if it doesn't exist, it adds (pushes) with you providing the key
  //if it does exist, it overwrites
  console.log("setDataInFirebase", folder, data);
  const dbRef = ref(db, folder)
  set(dbRef, data);
}

function deleteFromFirebase(folder, key) {
  console.log("deleting", folder + '/' + key);
  const dbRef = ref(db, folder + '/' + key);
  set(dbRef, null);
}

function subscribeToData() {
  //clearLocalScene()
  let folder = exampleName + "/";
  //get callbacks when there are changes either by you locally or others remotely
  if (existingSubscribedFolder) {
    const oldRef = ref(db, existingSubscribedFolder);
    console.log("unsubscribing from", existingSubscribedFolder, oldRef);
    off(oldRef);
  }
  existingSubscribedFolder = folder;
  const thisRef = ref(db, folder);
  console.log("subscribing to", folder, thisRef);
  onChildAdded(thisRef, (snapshot) => {
    let key = snapshot.key;
    let data = snapshot.val();
    //console.log("added", data, key);
    //transfer data into your local variable
    //replaces it if it already exists, otherwise makes a new entry
    myObjectsByFirebaseKey[key] = data;
    //if it is an image, load it
    if (data.type == "image") {
      let img = new Image(); //create a new image
      img.onload = function () {
        img.setAttribute("id", key + "_image");
        myObjectsByFirebaseKey[key].loadedImage = img;
      }
      img.src = data.imageURL;
    }
    console.log(myObjectsByFirebaseKey);
  });
  onChildChanged(thisRef, (snapshot) => {
    const key = snapshot.key;
    const value = snapshot.val();
    if (!key) {
      return;
    }
    myObjectsByFirebaseKey[key] = value;
    const img = new Image();
    img.onload = function () {
      myObjectsByFirebaseKey[key].loadedImage = img;
    };
    img.src = value.imageURL;
  });
  onChildRemoved(thisRef, (snapshot) => {
    const key = snapshot.key;
    console.log("removed", key);
    if (key && myObjectsByFirebaseKey[key]) {
      delete myObjectsByFirebaseKey[key];
    }
  });
  //la la la
}
