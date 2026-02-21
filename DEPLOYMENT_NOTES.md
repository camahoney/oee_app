# OEE App Deployment Architecture

This repository contains two distinct services:
1. **Frontend** (React / Vite)
2. **Backend** (FastAPI / Cloud SQL)

Due to repository restructuring over time, there are duplicate legacy folders (`Projects/OEE_App/...`).
**DO NOT use or commit code to the nested `Projects/` directories.**

## 1. Frontend (Netlify)
- **Deployment Root Directory:** `/frontend`
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Notes:** Netlify is strictly configured to track changes exclusively inside the root `/frontend` folder. Any UI components, pages, or features added outside of this folder will be completely ignored during the deployment process.

## 2. Backend (Render)
- **Deployment Root Directory:** `/backend`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Notes:** Render tracks changes made exclusively to the root `/backend` folder. If API endpoints (like `metrics.py` or `settings.py`) are modified inside the legacy nested `Projects/` folder, the live production database and server will not receive those updates. Always ensure API logic is written to `/backend` before pushing to GitHub.
