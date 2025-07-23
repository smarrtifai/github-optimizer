# GitHub Profile Analyzer - Installation Guide

This guide will help you set up and run the GitHub Profile Analyzer application.

## Prerequisites

- Python 3.7+ installed
- Web browser (Chrome, Firefox, Edge, etc.)
- GitHub Personal Access Token (for API access)

## Setup Instructions

### 1. Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python -m venv venv
   source venv/bin/activate
   ```

3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   - Copy the example environment file:
     ```
     # Windows
     copy .env.example .env
     
     # macOS/Linux
     cp .env.example .env
     ```
   - Edit the `.env` file and replace `your_github_token_here` with your GitHub Personal Access Token
   - You can create a token at: https://github.com/settings/tokens
   - Required permissions: `repo`, `read:user`

5. Run the Flask application:
   ```
   python app.py
   ```

   You should see output similar to:
   ```
   Starting GitHub Profile Analyzer backend...
   Using GitHub token: githu...xxxx
   Server running at http://localhost:5000
   ```

   Keep this terminal window open while using the application.

### 2. Frontend Setup

1. Simply open the `index.html` file in your web browser.

2. Enter a GitHub username or profile URL in the input field.

3. Click "Analyze" to generate the dashboard.

## Troubleshooting

### Backend Issues

- **Error: "ImportError: cannot import name 'url_quote' from 'werkzeug.urls'"**
  - Solution: Make sure you've installed the correct versions of Flask and Werkzeug as specified in requirements.txt.
  
- **Error: "Address already in use"**
  - Solution: Another application is using port 5000. Either close that application or modify the port number in app.py.

- **Error: "Warning: GITHUB_TOKEN not found in environment variables"**
  - Solution: Make sure you've created the `.env` file with your GitHub token.

### Frontend Issues

- **Error: "Failed to fetch profile data"**
  - Solution: Ensure the backend server is running at http://localhost:5000.

- **CORS Errors**
  - Solution: The backend has CORS enabled, but if you're still experiencing issues, try using a browser extension that disables CORS for development.

## GitHub API Rate Limits

The GitHub API has rate limits for requests. Using a personal access token increases these limits, but you may still encounter rate limiting if you make many requests in a short period.

If you encounter rate limiting, wait a few minutes before trying again.

## Security Notes

- Never commit your `.env` file containing your GitHub token to version control
- The `.gitignore` file is set up to exclude the `.env` file from Git
- If you accidentally expose your token, revoke it immediately on GitHub and generate a new one