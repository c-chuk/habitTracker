// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, set, get, update, remove, onValue } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";
import { GoogleGenerativeAI } from "https://cdn.skypack.dev/@google/generative-ai";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCYKS73GHaNMF2B7nLPGK_QT3g_Y67rU50",
    authDomain: "habit-tracker-e40f7.firebaseapp.com",
    databaseURL: "https://habit-tracker-e40f7-default-rtdb.firebaseio.com/",
    projectId: "habit-tracker-e40f7",
    storageBucket: "habit-tracker-e40f7.appspot.com",
    messagingSenderId: "199123901319",
    appId: "1:199123901319:web:4d48b995bbacbd5c43d122",
    measurementId: "G-WBQWCNDE4E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);
const firestore = getFirestore(app);

// DOM Elements
const habitNameInput = document.getElementById("habit-name");
const addHabitButton = document.getElementById("add-habit");
const habitsList = document.getElementById("habits");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-btn");
const chatHistory = document.getElementById("chat-history");
const toggleThemeButton = document.getElementById("toggle-theme");
const body = document.body;

let apiKey;
let genAI;
let model;

// Fetch API Key from Firestore
async function getApiKey() {
    try {
        let snapshot = await getDoc(doc(firestore, "apikey", "googlegenai"));
        if (snapshot.exists()) {
            apiKey = snapshot.data().key;
            genAI = new GoogleGenerativeAI(apiKey);
            model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            console.log("API Key Loaded Successfully!");
        } else {
            console.error("API Key not found in Firestore.");
        }
    } catch (error) {
        console.error("Error retrieving API Key:", error);
    }
}

// Function to Add Habit
async function addHabit(habitName) {
    if (!habitName) return;
    const habitRef = ref(db, "habits/" + habitName);
    try {
        await set(habitRef, { name: habitName, streak: 0 });
        appendMessage(`Habit "${habitName}" added`);
    } catch (error) {
        console.error("Error adding habit:", error);
        appendMessage("Error adding habit.");
    }
}

// Function to Delete Habit
async function deleteHabit(habitName) {
    if (!habitName) return;
    const habitRef = ref(db, "habits/" + habitName);
    try {
        await remove(habitRef);
        appendMessage(`Habit "${habitName}" deleted`);
    } catch (error) {
        console.error("Error deleting habit:", error);
        appendMessage("Error deleting habit.");
    }
}

// Function to Increase Streak
async function increaseStreak(habitName) {
    if (!habitName) return;
    const habitRef = ref(db, "habits/" + habitName);
    try {
        const snapshot = await get(habitRef);
        if (snapshot.exists()) {
            let currentStreak = snapshot.val().streak || 0;
            await update(habitRef, { streak: currentStreak + 1 });
            appendMessage(`Streak increased for "${habitName}"`);
        } else {
            appendMessage("Habit not found.");
        }
    } catch (error) {
        console.error("Error increasing streak:", error);
        appendMessage("Error increasing streak.");
    }
}

// Add Habit via Normal Input (Click or Enter Key)
addHabitButton.addEventListener("click", async () => {
    const habitName = habitNameInput.value.trim();
    if (habitName) {
        await addHabit(habitName);
        habitNameInput.value = "";
    }
});

// Allow Enter Key to Add Habit
habitNameInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        addHabitButton.click();
    }
});

// AI Chatbot Handling
function ruleChatBot(request) {
    if (request.startsWith("add habit")) {
        let habit = request.replace("add habit", "").trim();
        if (habit) {
            addHabit(habit);
        }
        return true;
    } else if (request.startsWith("delete habit")) {
        let habit = request.replace("delete habit", "").trim();
        if (habit) {
            deleteHabit(habit);
        }
        return true;
    } else if (request.startsWith("increase streak")) {
        let habit = request.replace("increase streak", "").trim();
        if (habit) {
            increaseStreak(habit);
        }
        return true;
    }
    return false;
}

// AI Chatbot API Call
async function askChatBot(request) {
    try {
        if (!model) {
            appendMessage("Chatbot: AI model is not loaded yet. Try again later.");
            return;
        }
        const response = await model.generateContent({ contents: [{ parts: [{ text: request }] }] });
        if (response && response.data && response.data.candidates) {
            const botReply = response.data.candidates[0]?.content?.parts[0]?.text || "I don't understand that.";
            appendMessage("Chatbot: " + botReply);
        } else {
            appendMessage("Chatbot: No valid response received.");
        }
    } catch (error) {
        console.error("Chatbot error:", error);
        appendMessage("Chatbot: Error processing request.");
    }
}

// Allow Enter Key to Send AI Chat Request
chatInput.addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendButton.click();
    }
});

// Append Messages to Chat History
function appendMessage(message) {
    let history = document.createElement("div");
    history.textContent = message;
    history.className = "history";
    chatHistory.appendChild(history);
    chatInput.value = "";
}

// Handle AI Chatbot Input
sendButton.addEventListener("click", async () => {
    let prompt = chatInput.value.trim().toLowerCase();
    if (prompt) {
        appendMessage("You: " + prompt);
        if (!ruleChatBot(prompt)) {
            await askChatBot(prompt);
        }
    } else {
        appendMessage("Please enter a prompt.");
    }
});

// Update Habit List
onValue(ref(db, "habits"), (snapshot) => {
    habitsList.innerHTML = "";

    if (!snapshot.exists()) {
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const habit = childSnapshot.val();
        const habitKey = childSnapshot.key;

        const li = document.createElement("li");
        li.innerHTML = `${habit.name} - Streak: <span>${habit.streak}</span>`;
        li.tabIndex = 0;

        const incrementButton = document.createElement("button");
        incrementButton.textContent = "+";
        incrementButton.setAttribute("aria-label", `Increase streak for ${habit.name}`);
        incrementButton.addEventListener("click", async () => {
            await increaseStreak(habitKey);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "-";
        deleteButton.setAttribute("aria-label", `Delete habit ${habit.name}`);
        deleteButton.addEventListener("click", async () => {
            await deleteHabit(habitKey);
        });

        li.appendChild(incrementButton);
        li.appendChild(deleteButton);
        habitsList.appendChild(li);
    });
});

// Function to Toggle Dark Mode
function toggleTheme() {
    body.classList.toggle("dark-mode");
    const isDarkMode = body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDarkMode ? "dark" : "green");
}

// Function to Load Theme (Default to Green)
function loadTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        body.classList.add("dark-mode");
    } else {
        body.classList.remove("dark-mode"); 
        localStorage.setItem("theme", "green");
    }
}

// Attach Theme Toggle Event Listener
toggleThemeButton.addEventListener("click", toggleTheme);

// Load Theme on Page Load (Defaults to Green)
loadTheme();

// Initialize API Key on Page Load
getApiKey();
