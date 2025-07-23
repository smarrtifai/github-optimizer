# GitHub Profile Analyzer

A web-based tool designed to provide comprehensive and visually engaging insights into a user's GitHub activity.

## Features

- **Profile Overview**: Display essential profile details such as name, bio, follower count, and public repository count.

- **Commit Activity Timeline**: A detailed line chart illustrating commit frequency over time with filtering options:
  - Last 1 Month
  - Last 3 Months
  - Last 6 Months
  - Last 1 Year
  - All Time (from profile creation to present)

- **Language Distribution (Repositories)**: A pie chart showcasing the breakdown of programming languages used across public repositories.

- **Language Distribution (Commits)**: A pie chart visualizing commit activity by programming language.

- **Recent Activity Stream**: A line chart detailing recent interactions, such as new repositories, pull requests, or issues.

- **Repository Size Distribution**: A bar chart showing the distribution of repositories by size categories (Tiny, Small, Medium, Large, Very Large).

- **Star & Fork Analysis**: A comparative bar chart of the top 5 repositories by stars, showing both star and fork counts.

- **Repository Metrics**: A comprehensive dashboard of repository statistics including:
  - Total repositories (original vs. forked)
  - Total stars and forks
  - Open issues count
  - Average repository size and age
  - Account age and repository creation rate
  - Follower ratio and engagement metrics

## Project Structure

- **Frontend**: HTML, CSS, and JavaScript for the user interface
  - `index.html`: Main HTML file
  - `css/style.css`: Styling for the application
  - `js/app.js`: Frontend JavaScript for UI rendering and API calls

- **Backend**: Python Flask application for GitHub API interactions
  - `backend/app.py`: Flask application with API endpoints
  - `backend/requirements.txt`: Python dependencies

## Setup and Running

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Set up environment variables:
   - Copy `.env`
   - Replace the placeholder with your GitHub token
   ```
   # Windows
   copy  .env
   
   # macOS/Linux
   cp .env
   ```
   - Edit the `.env` file to add your GitHub token

6. Run the Flask application:
   ```
   python app.py
   ```

   The backend will run on http://localhost:5000

