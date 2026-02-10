# OEE Analytics Web Application

A professional manufacturing analytics dashboard for calculating OEE (Overall Equipment Effectiveness) from production reports.

## Prerequisites

To run this application, you need to have the following installed on your computer:

1.  **Node.js & npm**: Required for the frontend.
    *   Download and install from: [https://nodejs.org/](https://nodejs.org/) (Select "LTS" version).
    *   Verify installation by running `node -v` and `npm -v` in your terminal.

2.  **Python**: Required for the backend.
    *   Download and install from: [https://www.python.org/](https://www.python.org/).
    *   Verify by running `python --version`.

## Setup Instructions

### 1. Backend Setup

The backend handles the database, authentication, and calculations.

1.  Open a terminal (PowerShell or Command Prompt).
2.  Navigate to the backend directory:
    ```bash
    cd "C:\Users\cmaho\Desktop\Antigravity Test Folder\oee_app\backend"
    ```
3.  (Optional but recommended) Create a virtual environment:
    ```bash
    python -m venv venv
    .\venv\Scripts\activate
    ```
4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
5.  Start the backend server:
    ```bash
    uvicorn app.main:app --reload
    ```
    *   The API will be running at `http://127.0.0.1:8000`.
    *   You can view interactive API documentation at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

The frontend provides the user interface.

1.  Open a **new** terminal window (keep the backend running).
2.  Navigate to the frontend directory:
    ```bash
    cd "C:\Users\cmaho\Desktop\Antigravity Test Folder\oee_app\frontend"
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
    *   The app will open in your browser at `http://localhost:5173` (or similar).

## Usage Guide

1.  **Register/Login**: (Not yet fully connected in UI, currently uses API).
2.  **Rates**: Go to the "Rates" tab. Upload the provided `templates/rates_template.csv` to populate the master rates.
3.  **Upload**: Go to "Upload & Analyze". Upload the `templates/report_template.csv`.
4.  **Dashboard**: View the calculated OEE metrics.

## Deployment (Netlify)

To deploy the frontend to Netlify:
1.  Push this code to a GitHub repository.
2.  Connect the repo to Netlify.
3.  Set the build command to `npm run build` and publish directory to `dist`.
4.  **Note**: You must host the Backend separately (e.g., Render, Railway) and update the frontend API URL to point to the live backend.
