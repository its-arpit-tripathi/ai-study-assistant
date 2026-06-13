# AI Study Assistant

I have successfully built the **AI Study Assistant** using React, Tailwind CSS, and Node.js with Express, powered by the Google Gemini API. The application is a fully realized single-page web app with a premium, responsive design.

## Features Implemented

1. **📄 Upload Notes & Summarize**
   - Drag-and-drop or select `.txt` and `.md` files
   - Read content locally and send it to the Gemini API (`/api/summarize`)
   - Receive and render a beautifully formatted markdown summary
   - Assign subjects to uploaded notes

2. **🧠 Generate Quiz**
   - Automatically generates multiple-choice questions based on all uploaded notes (or filtered by a specific subject)
   - Uses Gemini API (`/api/quiz`) to generate strict JSON formats
   - Interactive quiz UI showing correct/incorrect answers with explanations and final score

3. **🎤 Voice Q&A**
   - Integrated with the native browser Web Speech API
   - Tap the microphone button to ask a question verbally, or type it
   - Sends the question along with the context of your uploaded notes to Gemini API (`/api/ask`)
   - Uses Speech Synthesis to read out the answer aloud

4. **🌙 Dark Mode**
   - Full implementation of a beautiful dark/light theme
   - State stored in `localStorage` for persistence across reloads

5. **📚 Subject Filter**
   - Add custom subjects via the sidebar
   - Filter notes and quizzes by specific subjects

## How to Run

1. **Set your API Key**
   - Open the file `server/.env`
   - Replace `your_gemini_api_key_here` with your actual Google Gemini API key:
     ```env
     GEMINI_API_KEY=your_actual_key_here
     PORT=5000
     ```

2. **Start the Application**
   - Open your terminal in the `d:\ai_study_assistent` directory
   - Run the command:
     ```bash
     npm start
     ```
   - This single command will run both the Express backend (on port 5000) and the Vite React frontend (on port 5173).

3. **Open the browser**
   - Navigate to `http://localhost:5173` to use the application.

> **Note:** The Voice Q&A feature uses the Web Speech API (`SpeechRecognition`), which is best supported on **Google Chrome**. If you are using another browser, the microphone button will gracefully fallback to typing only.

## Deployment (Vercel & Render)

If you are deploying the application to production, make sure to set the correct environment variables:

1. **Render (Backend)**
   - Add `GEMINI_API_KEY` (Your Google Gemini API Key).
   - Add `FRONTEND_URL` (The URL of your deployed Vercel application, e.g., `https://my-ai-study-app.vercel.app`). This is required for CORS configuration.

2. **Vercel (Frontend)**
   - Add `VITE_API_URL` to point to your deployed Render backend (e.g., `https://my-render-app.onrender.com/api`). Without this, the frontend will fail to reach the remote API.
