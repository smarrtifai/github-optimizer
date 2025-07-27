import os
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime, timedelta
import google.generativeai as genai
from google.generativeai.types import GenerationConfig

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')  # Optional: for higher rate limits
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')  # Required for AI insights

# Initialize Gemini AI
gemini_model = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('Gemini 1.5 Flash')
        print("✅ Gemini AI initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize Gemini AI: {e}")
        gemini_model = None
else:
    print("⚠️ GEMINI_API_KEY not found in environment variables. AI insights will not work.")
    print("   Please add GEMINI_API_KEY=your_api_key to your .env file")

# Helper function to get GitHub headers
def get_github_headers():
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Profile-Analyzer'
    }
    if GITHUB_TOKEN:
        headers['Authorization'] = f'token {GITHUB_TOKEN}'
    return headers

# Test route
@app.route('/')
def home():
    return jsonify({
        'message': 'GitHub Profile Analyzer API',
        'status': 'running',
        'gemini_configured': gemini_model is not None,
        'github_token_configured': GITHUB_TOKEN is not None
    })

@app.route('/api/insights/<username>')
def generate_insights(username):
    try:
        if not gemini_model:
            return jsonify({
                'error': 'Gemini AI is not configured. Please check your GEMINI_API_KEY in .env file'
            }), 500

        headers = get_github_headers()

        profile_url = f'https://api.github.com/users/{username}'
        profile_resp = requests.get(profile_url, headers=headers)

        if not profile_resp.ok:
            if profile_resp.status_code == 404:
                return jsonify({'error': f'GitHub user "{username}" not found'}), 404
            elif profile_resp.status_code == 403:
                return jsonify({'error': 'GitHub API rate limit exceeded. Please try again later.'}), 429
            else:
                return jsonify({'error': f'Failed to fetch GitHub profile: {profile_resp.status_code}'}), 500

        profile_data = profile_resp.json()

        repos_url = f'https://api.github.com/users/{username}/repos?sort=updated&per_page=30'
        repos_resp = requests.get(repos_url, headers=headers)

        if not repos_resp.ok:
            return jsonify({'error': f'Failed to fetch repositories: {repos_resp.status_code}'}), 500

        repos_data = repos_resp.json()

        total_stars = sum(repo.get('stargazers_count', 0) for repo in repos_data)
        total_forks = sum(repo.get('forks_count', 0) for repo in repos_data)
        total_size = sum(repo.get('size', 0) for repo in repos_data)

        languages = {}
        for repo in repos_data:
            lang = repo.get('language')
            if lang:
                languages[lang] = languages.get(lang, 0) + 1

        top_languages = sorted(languages.items(), key=lambda x: x[1], reverse=True)[:5]

        created_date = datetime.strptime(profile_data.get('created_at', ''), '%Y-%m-%dT%H:%M:%SZ')
        account_age_days = (datetime.now() - created_date).days
        account_age_years = round(account_age_days / 365, 1)

        # Construct prompt
        prompt = f"""
Analyze this GitHub developer profile and provide a comprehensive career insight report in the following format:

**DEVELOPER PROFILE ANALYSIS FOR {username.upper()}**

**1. OVERALL ASSESSMENT**
- Overall Score: X/100
- Developer Level: Junior/Mid-level/Senior/Expert
- Primary Focus: Backend/Frontend/Full-stack/DevOps/etc.

**2. SCORING BREAKDOWN**
- Technical Skills: X/30
- Project Portfolio: X/25
- Community Engagement: X/20
- Consistency & Activity: X/15
- Innovation & Impact: X/10

**3. RECOMMENDED CAREER PATHS**
List 3–5 job roles best suited for this developer.

**4. STRENGTHS ANALYSIS**
- Technical Strengths
- Project Strengths
- Professional Strengths

**5. AREAS FOR IMPROVEMENT**
- Technical Skills
- Portfolio Enhancement
- Community Engagement

**6. ACTIONABLE CAREER RECOMMENDATIONS**
- Short-term goals
- Medium-term goals
- Learning resources

**PROFILE DATA:**
- Name: {profile_data.get('name', 'N/A')}
- Username: {username}
- Bio: {profile_data.get('bio', 'No bio provided')}
- Location: {profile_data.get('location', 'N/A')}
- Company: {profile_data.get('company', 'N/A')}
- Website: {profile_data.get('blog', 'N/A')}
- Public Repos: {profile_data.get('public_repos', 0)}
- Followers: {profile_data.get('followers', 0)}
- Following: {profile_data.get('following', 0)}
- Account Age: {account_age_years} years
- Total Stars: {total_stars}
- Total Forks: {total_forks}
- Total Size: {total_size} KB

**TOP LANGUAGES:**
{', '.join([f"{lang} ({count} repos)" for lang, count in top_languages]) if top_languages else 'No languages detected'}

**REPO SNAPSHOT (Latest 5):**
"""

        for i, repo in enumerate(repos_data[:5], 1):  # ✅ Reduced to top 5
            last_updated = repo.get('updated_at', '')
            try:
                updated_date = datetime.strptime(last_updated, '%Y-%m-%dT%H:%M:%SZ')
                last_updated = f"{(datetime.now() - updated_date).days} days ago"
            except:
                last_updated = "Unknown"

            prompt += f"""
{i}. **{repo.get('name', 'Unnamed')}**
   - Description: {repo.get('description', 'No description')}
   - Language: {repo.get('language', 'Not specified')}
   - Stars: {repo.get('stargazers_count', 0)}
   - Forks: {repo.get('forks_count', 0)}
   - Last Updated: {last_updated}
   - Size: {repo.get('size', 0)} KB
   - Is Fork: {repo.get('fork', False)}
"""

        prompt += "\nBe realistic, detailed, and honest. Base your analysis only on available evidence."

        # Gemini API Call with timeout config
        try:
            print(f"🤖 Calling Gemini API for {username}...")
            generation_config = GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                max_output_tokens=1024
            )
            response = gemini_model.generate_content(prompt, generation_config=generation_config)
            insight = response.text

            if not insight or len(insight.strip()) < 50:
                return jsonify({'error': 'Generated insight was too short or empty'}), 500

            print(f"✅ Gemini insight generated for {username}")

            return jsonify({
                'insight': insight,
                'profile_summary': {
                    'username': username,
                    'name': profile_data.get('name'),
                    'public_repos': profile_data.get('public_repos', 0),
                    'total_stars': total_stars,
                    'account_age_years': account_age_years,
                    'top_languages': dict(top_languages[:3]),
                    'generated_at': datetime.now().isoformat()
                }
            })

        except Exception as gemini_error:
            print(f"❌ Gemini API Error: {gemini_error}")
            return jsonify({'error': f'AI insight generation failed: {str(gemini_error)}'}), 500

    except requests.RequestException as req_error:
        print(f"❌ GitHub API Request Error: {req_error}")
        return jsonify({'error': f'GitHub API request failed: {str(req_error)}'}), 500

    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return jsonify({'error': f'Insight generation failed: {str(e)}'}), 500

if __name__ == '__main__':
    print("🚀 Starting GitHub Profile Analyzer API...")
    print(f"   Gemini AI: {'✅ Configured' if gemini_model else '❌ Not configured'}")
    print(f"   GitHub Token: {'✅ Configured' if GITHUB_TOKEN else '⚠️ Not configured (rate limited)'}")
    print("   Server running on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
