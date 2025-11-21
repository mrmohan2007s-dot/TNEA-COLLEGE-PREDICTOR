# TNEA-COLLEGE-PREDICTOR

This repo serves a static frontend and a small Flask API for a TNEA college predictor.

Quick start (Windows PowerShell):

```powershell
# Create and activate a venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
python -m pip install -r requirements.txt

# Run the Flask API (uses the Flask CLI)
$env:FLASK_APP = 'api.index'
flask run
```

The project is configured for Vercel using `vercel.json`. Pushing to the linked Vercel project will trigger a redeploy.

If you want a Docker image or deployment to another provider, tell me and I'll add it.
