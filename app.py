from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import requests
import datetime
import random
import os
from dotenv import load_dotenv
import google.generativeai as genai
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from google.generativeai.types import GenerationConfig

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# --- MongoDB Connection ---
MONGO_URI = os.getenv('MONGO_URI')
db = None
profiles_collection = None
if MONGO_URI:
    try:
        client = MongoClient(MONGO_URI)
        # The ismaster command is cheap and does not require auth.
        client.admin.command('ismaster')
        db = client.github_analyzer # Use a database named 'github_analyzer'
        profiles_collection = db.profiles # Use a collection named 'profiles'
        print("✅ MongoDB connection successful.")
    except ConnectionFailure as e:
        print(f"❌ MongoDB connection failed: {e}")
        db = None
else:
    print("⚠️ MONGO_URI not found. Database features will be disabled.")

# GitHub API token from environment variable
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
HEADERS = {'Authorization': f'token {GITHUB_TOKEN}'}

@app.route('/api/profile/<username>')
def get_profile(username):
    """Get GitHub user profile data and save it to MongoDB"""
    try:
        # Get basic profile data
        response = requests.get(f'https://api.github.com/users/{username}', headers=HEADERS)
        response.raise_for_status()
        profile_data = response.json()

        # --- Fetch all repositories to calculate total stars ---
        repos = []
        page = 1
        has_more_repos = True
        while has_more_repos:
            repos_response = requests.get(
                f'https://api.github.com/users/{username}/repos',
                headers=HEADERS,
                params={'page': page, 'per_page': 100}
            )
            repos_response.raise_for_status()
            repos_page = repos_response.json()
            if not repos_page:
                has_more_repos = False
            else:
                repos.extend(repos_page)
                page += 1
        total_stars = sum(repo.get('stargazers_count', 0) for repo in repos)

        # Get additional stats from GitHub API
        stats = {'total_stars': total_stars}
        
        # Get PRs created by user
        try:
            pr_response = requests.get(
                f'https://api.github.com/search/issues?q=author:{username}+type:pr',
                headers=HEADERS
            )
            if pr_response.ok:
                pr_data = pr_response.json()
                stats['total_prs'] = pr_data.get('total_count', 0)
        except Exception as e:
            print(f"Error fetching PR data: {e}")
            stats['total_prs'] = 0
        
        # Get issues created by user
        try:
            issue_response = requests.get(
                f'https://api.github.com/search/issues?q=author:{username}+type:issue',
                headers=HEADERS
            )
            if issue_response.ok:
                issue_data = issue_response.json()
                stats['total_issues'] = issue_data.get('total_count', 0)
        except Exception as e:
            print(f"Error fetching issue data: {e}")
            stats['total_issues'] = 0
        
        # Get repositories contributed to with better accuracy
        try:
            # Fetch more events for better contribution tracking
            all_events = []
            for page in range(1, 6):  # Get up to 5 pages
                events_response = requests.get(
                    f'https://api.github.com/users/{username}/events',
                    headers=HEADERS,
                    params={'per_page': 100, 'page': page}
                )
                if events_response.ok:
                    page_events = events_response.json()
                    if not page_events:
                        break
                    all_events.extend(page_events)
                else:
                    break
            
            # Get unique repos from various events in the last year
            one_year_ago = datetime.datetime.now() - datetime.timedelta(days=365)
            contributed_repos = set()
            
            for event in all_events:
                event_date = datetime.datetime.strptime(event['created_at'], '%Y-%m-%dT%H:%M:%SZ')
                if event_date > one_year_ago:
                    # Include more event types for better tracking
                    if event['type'] in ['PushEvent', 'PullRequestEvent', 'IssuesEvent', 'CreateEvent', 'ForkEvent']:
                        if 'repo' in event:
                            contributed_repos.add(event['repo']['name'])
            
            stats['contributed_to'] = len(contributed_repos)
        except Exception as e:
            print(f"Error fetching events data: {e}")
            stats['contributed_to'] = 0
        
        # Get commit count using GraphQL-style approach with events
        current_year = datetime.datetime.now().year
        try:
            commit_count = 0
            # Fetch more events for better accuracy
            all_events = []
            for page in range(1, 6):  # Get up to 5 pages (500 events)
                events_response = requests.get(
                    f'https://api.github.com/users/{username}/events',
                    headers=HEADERS,
                    params={'per_page': 100, 'page': page}
                )
                if events_response.ok:
                    page_events = events_response.json()
                    if not page_events:
                        break
                    all_events.extend(page_events)
                else:
                    break
            
            # Count commits from current year
            for event in all_events:
                if event['type'] == 'PushEvent':
                    event_date = datetime.datetime.strptime(event['created_at'], '%Y-%m-%dT%H:%M:%SZ')
                    if event_date.year == current_year:
                        if 'payload' in event and 'commits' in event['payload']:
                            commit_count += len(event['payload']['commits'])
            
            stats['commits_current_year'] = commit_count
        except Exception as e:
            print(f"Error calculating commit count: {e}")
            stats['commits_current_year'] = 0

        # --- Enhanced rating calculation ---
        def calculate_rating(profile, stars, commits, prs, issues, contributions, repos_count):
            # Base scores with new weighting: Stars (5%), Commits (55%), PRs (15%), Issues (10%), Contributions (15%)
            star_score = min(5, stars * 0.05)  # Stars (5%)
            commit_score = min(55, commits * 0.15)  # Commits (55%) - most important
            pr_score = min(15, prs * 0.3)  # PRs (15%)
            issue_score = min(10, issues * 0.2)  # Issues (10%)
            contribution_score = min(15, contributions * 2)  # Contributions (15%)
            
            # Account age bonus (more mature accounts get slight bonus)
            account_age_days = (datetime.datetime.now() - datetime.datetime.strptime(profile['created_at'], '%Y-%m-%dT%H:%M:%SZ')).days
            age_bonus = min(5, account_age_days / 365)  # Max 5 points for 1+ year accounts
            
            # Repository quality bonus
            repo_bonus = min(10, repos_count * 0.5)  # Quality over quantity
            
            total_score = round(star_score + commit_score + pr_score + issue_score + contribution_score + age_bonus + repo_bonus)
            return max(0, min(100, total_score))

        rating = calculate_rating(
            profile_data,
            stats.get('total_stars', 0),
            stats.get('commits_current_year', 0),
            stats.get('total_prs', 0),
            stats.get('total_issues', 0),
            stats.get('contributed_to', 0),
            profile_data.get('public_repos', 0)
        )
        stats['rating'] = rating
        # --- Save/Update profile in MongoDB ---
        if profiles_collection is not None:
            try:
                # Prepare the document to be saved
                user_document = {
                    'github_id': profile_data['id'],
                    'name': profile_data.get('name'),
                    'bio': profile_data.get('bio'),
                    'email': profile_data.get('email'),
                    'blog': profile_data.get('blog'),
                    'company': profile_data.get('company'),
                    'location': profile_data.get('location'),
                    'html_url': profile_data.get('html_url'),
                    'public_repos': profile_data.get('public_repos'),
                    'followers': profile_data.get('followers'),
                    'created_at': datetime.datetime.strptime(profile_data['created_at'], '%Y-%m-%dT%H:%M:%SZ'),
                    'last_fetched_profile': datetime.datetime.utcnow(),
                    'rating': rating
                }
                
                # Use update_one with upsert=True to insert or update the document
                # The document _id will be the GitHub username (login)
                profiles_collection.update_one(
                    {'_id': profile_data['login']},
                    {'$set': user_document},
                    upsert=True
                )
                print(f"✅ Saved profile for '{username}' to MongoDB.")
            except Exception as e:
                print(f"❌ Failed to save profile for '{username}' to MongoDB: {e}")
        # --- End of MongoDB logic ---

        # Add stats to profile data
        profile_data['stats'] = stats
        
        return jsonify(profile_data)
    except requests.exceptions.RequestException as e:
        if hasattr(e, 'response') and e.response is not None and e.response.status_code == 404:
            return jsonify({'error': f"User '{username}' not found on GitHub"}), 404
        print(f"❌ Request error fetching profile for {username}: {e}")
        return jsonify({'error': 'A network or API error occurred while fetching the profile.'}), 500
    except Exception as e:
        print(f"❌ Unexpected error in get_profile for {username}: {e}")
        return jsonify({'error': 'An unexpected internal server error occurred.'}), 500

@app.route('/api/repos/<username>')
def get_repositories(username):
    """Get user repositories"""
    try:
        repos = []
        page = 1
        has_more_repos = True
        
        while has_more_repos:
            response = requests.get(
                f'https://api.github.com/users/{username}/repos',
                headers=HEADERS,
                params={'page': page, 'per_page': 100}
            )
            response.raise_for_status()
            
            repos_page = response.json()
            if not repos_page:
                has_more_repos = False
            else:
                repos.extend(repos_page)
                page += 1
        
        return jsonify(repos)
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error fetching repositories for {username}: {e}")
        return jsonify({'error': 'A network or API error occurred while fetching repositories.'}), 500
    except Exception as e:
        print(f"❌ Unexpected error in get_repositories for {username}: {e}")
        return jsonify({'error': 'An unexpected internal server error occurred.'}), 500

@app.route('/api/languages/<username>/<repo>')
def get_languages(username, repo):
    """Get languages for a specific repository"""
    try:
        response = requests.get(
            f'https://api.github.com/repos/{username}/{repo}/languages',
            headers=HEADERS
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error fetching languages for {username}/{repo}: {e}")
        return jsonify({'error': 'A network or API error occurred while fetching languages.'}), 500
    except Exception as e:
        print(f"❌ Unexpected error in get_languages for {username}/{repo}: {e}")
        return jsonify({'error': 'An unexpected internal server error occurred.'}), 500

@app.route('/api/user-languages/<username>')
def get_user_languages(username):
    """Get aggregated language statistics for a user"""
    try:
        # Get user's repositories
        repos_response = requests.get(
            f'https://api.github.com/users/{username}/repos',
            headers=HEADERS,
            params={'per_page': 100}
        )
        repos_response.raise_for_status()
        repos = repos_response.json()
        
        # Aggregate languages across all repositories
        languages = {}
        
        for repo in repos:
            # Skip forks to focus on user's own code
            if repo.get('fork', False):
                continue
                
            try:
                lang_response = requests.get(
                    repo['languages_url'],
                    headers=HEADERS
                )
                
                if lang_response.ok:
                    repo_languages = lang_response.json()
                    
                    for lang, bytes_count in repo_languages.items():
                        if lang in languages:
                            languages[lang] += bytes_count
                        else:
                            languages[lang] = bytes_count
            except Exception as e:
                print(f"Error fetching languages for {repo['name']}: {e}")
        
        return jsonify(languages)
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error fetching user languages for {username}: {e}")
        return jsonify({'error': 'A network or API error occurred while fetching user languages.'}), 500
    except Exception as e:
        print(f"❌ Unexpected error in get_user_languages for {username}: {e}")
        return jsonify({'error': 'An unexpected internal server error occurred.'}), 500

@app.route('/api/commits/<username>')
def get_commits(username):
    """Get commit activity for a user's repositories using their events."""
    try:
        time_range = request.args.get('timeRange', '1month')
        end_date = datetime.datetime.now(datetime.timezone.utc)
        
        days_map = {
            '15days': 15, '1month': 30, '3months': 90, 
            '6months': 180, '1year': 365, 'all': 1095 # Approx 3 years for 'all'
        }
        num_days = days_map.get(time_range, 30)
        start_date = end_date - datetime.timedelta(days=num_days)

        # Fetch user events (paginated)
        events = []
        for page in range(1, 11): # Fetch up to 10 pages (1000 events)
            events_response = requests.get(
                f'https://api.github.com/users/{username}/events',
                headers=HEADERS,
                params={'per_page': 100, 'page': page}
            )
            if not events_response.ok:
                break
            
            page_events = events_response.json()
            if not page_events:
                break
            events.extend(page_events)

        # Initialize commit counts for each day in the range
        commit_counts_by_date = {
            (start_date + datetime.timedelta(days=i)).strftime('%Y-%m-%d'): 0
            for i in range(num_days + 1)
        }

        # Process events
        for event in events:
            if event['type'] == 'PushEvent':
                event_date_utc = datetime.datetime.strptime(event['created_at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)
                if start_date <= event_date_utc <= end_date:
                    date_str = event_date_utc.strftime('%Y-%m-%d')
                    if date_str in commit_counts_by_date:
                        commit_counts_by_date[date_str] += len(event['payload'].get('commits', []))

        # Format for chart
        sorted_dates = sorted(commit_counts_by_date.keys())
        commit_data = {
            'dates': sorted_dates,
            'counts': [commit_counts_by_date[d] for d in sorted_dates]
        }

        return jsonify(commit_data)
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error fetching commits for {username}: {e}")
        return jsonify({'error': 'A network or API error occurred while fetching commits.'}), 500
    except Exception as e:
        print(f"❌ Unexpected error in get_commits for {username}: {e}")
        return jsonify({'error': 'An unexpected internal server error occurred.'}), 500

@app.route('/api/activity/<username>')
def get_activity(username):
    """Get recent activity for a user from the GitHub Events API with time filtering."""
    try:
        time_range = request.args.get('timeRange', '1month')
        end_date = datetime.datetime.now(datetime.timezone.utc)
        
        days_map = {
            '15days': 15, '1month': 30, '3months': 90, 
            '6months': 180, '1year': 365, 'all': 1095 # Approx 3 years for 'all'
        }
        num_days = days_map.get(time_range, 30)
        start_date = end_date - datetime.timedelta(days=num_days)
        
        # Fetch user events with better pagination
        events = []
        max_pages = 15 if time_range in ['all', '1year'] else 8  # More pages for longer ranges
        
        for page in range(1, max_pages + 1):
            events_response = requests.get(
                f'https://api.github.com/users/{username}/events',
                headers=HEADERS,
                params={'per_page': 100, 'page': page}
            )
            if not events_response.ok:
                print(f"Failed to fetch events page {page}: {events_response.status_code}")
                break
            
            page_events = events_response.json()
            if not page_events:
                break
            
            events.extend(page_events)
            
            # Stop early if we have events older than our time range
            if page_events:
                oldest_event_date = datetime.datetime.strptime(page_events[-1]['created_at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)
                if oldest_event_date < start_date:
                    break
        
        # Create date strings for the specified time range
        date_keys = [(start_date + datetime.timedelta(days=i)).strftime('%Y-%m-%d') for i in range(num_days + 1)]
        
        activity = {
            'pullRequests': {d: 0 for d in date_keys},
            'issues': {d: 0 for d in date_keys},
            'commits': {d: 0 for d in date_keys}
        }

        # Process events
        for event in events:
            event_date_utc = datetime.datetime.strptime(event['created_at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)
            if start_date <= event_date_utc <= end_date:
                date_str = event_date_utc.strftime('%Y-%m-%d')
                
                # More accurate event processing
                if event['type'] == 'PushEvent':
                    commits = event['payload'].get('commits', [])
                    if commits:  # Only count if there are actual commits
                        activity['commits'][date_str] += len(commits)
                elif event['type'] == 'PullRequestEvent':
                    action = event['payload'].get('action')
                    if action in ['opened', 'reopened']:  # Count both opened and reopened PRs
                        activity['pullRequests'][date_str] += 1
                elif event['type'] == 'IssuesEvent':
                    action = event['payload'].get('action')
                    if action in ['opened', 'reopened']:  # Count both opened and reopened issues
                        activity['issues'][date_str] += 1
        
        # Format for chart
        return jsonify({
            'dates': date_keys,
            'activities': {
                'pullRequests': [activity['pullRequests'][d] for d in date_keys],
                'issues': [activity['issues'][d] for d in date_keys],
                'commits': [activity['commits'][d] for d in date_keys]
            }
        })
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error fetching activity for {username}: {e}")
        return jsonify({'error': 'A network or API error occurred while fetching activity.'}), 500
    except Exception as e:
        print(f"❌ Unexpected error in get_activity for {username}: {e}")
        return jsonify({'error': 'An unexpected internal server error occurred.'}), 500
    
#################################################################
# Gemini AI Integration and additional routes
#################################################################

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')  # Required for AI insights

# Initialize Gemini AI
gemini_model = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        print("✅ Gemini AI initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize Gemini AI: {e}")
        gemini_model = None
else:
    print("⚠️ GEMINI_API_KEY not found in environment variables. AI insights will not work.")
    print("   Please add GEMINI_API_KEY=your_api_key to your .env file")

# Helper function to get GitHub headers
def get_github_headers():
    """Get headers for GitHub API requests"""
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Profile-Analyzer'
    }
    if GITHUB_TOKEN:
        headers['Authorization'] = f'token {GITHUB_TOKEN}'
    return headers

# Serve frontend
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

# API status route
@app.route('/api/status')
def status():
    return jsonify({
        'message': 'GitHub Profile Analyzer API',
        'status': 'running',
        'gemini_configured': gemini_model is not None,
        'github_token_configured': GITHUB_TOKEN is not None,
        'mongodb_configured': db is not None
    })

@app.route('/api/insights/<username>')
def generate_insights(username):
    """Generate Gemini-powered career insights based on GitHub profile"""
    try:
        # Check if Gemini is configured
        if not gemini_model:
            return jsonify({
                'error': 'Gemini AI is not configured. Please check your GEMINI_API_KEY in .env file'
            }), 500

        # Get GitHub headers
        headers = get_github_headers()
        
        # 1. Fetch GitHub profile data
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
        
        # 2. Fetch repositories data
        repos_url = f'https://api.github.com/users/{username}/repos?sort=updated&per_page=30'
        repos_resp = requests.get(repos_url, headers=headers)
        
        if not repos_resp.ok:
            return jsonify({'error': f'Failed to fetch repositories: {repos_resp.status_code}'}), 500
        
        repos_data = repos_resp.json()

        # 3. Calculate additional stats
        total_stars = sum(repo.get('stargazers_count', 0) for repo in repos_data)
        total_forks = sum(repo.get('forks_count', 0) for repo in repos_data)
        total_size = sum(repo.get('size', 0) for repo in repos_data)
        
        # Count languages
        languages = {}
        for repo in repos_data:
            lang = repo.get('language')
            if lang:
                languages[lang] = languages.get(lang, 0) + 1

        # Get top languages
        top_languages = sorted(languages.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Calculate account age
        created_date = datetime.datetime.strptime(profile_data.get('created_at', ''), '%Y-%m-%dT%H:%M:%SZ')
        account_age_days = (datetime.datetime.now() - created_date).days
        account_age_years = round(account_age_days / 365, 1)

        # 4. Construct Optimized Prompt for Gemini
        prompt = f"""
Analyze GitHub developer {username}:

**PROFILE:** {profile_data.get('name', username)} | {profile_data.get('public_repos', 0)} repos | {total_stars} stars | {account_age_years}y old
**LANGUAGES:** {', '.join([f"{lang}" for lang, count in top_languages[:3]]) if top_languages else 'None'}

Provide concise insights in 4 sections:

**1. TECHNICAL ASSESSMENT**
- Rate skills based on languages and repo complexity
- Identify primary tech stack

**2. CAREER RECOMMENDATIONS** 
- Suggest 3 specific roles matching their profile
- Base on actual repo activity

**3. STRENGTHS**
- Key technical and project strengths

**4. Suggestions**
- 2-3 specific improvement suggestions

Keep response under 500 words. Be specific and actionable.
"""



        # 5. Query Gemini API
        try:
            print(f"🤖 Calling Gemini API for {username}...")
            generation_config = GenerationConfig(
                temperature=0.5,
                top_p=0.8,
                max_output_tokens=1024
            )
            gemini_response = gemini_model.generate_content(
                prompt,
                generation_config=generation_config
            )
            insight_text = gemini_response.text
            
            # Basic validation
            if not insight_text or len(insight_text.strip()) < 50:
                return jsonify({'error': 'Generated insight was too short or empty'}), 500
            
            print(f"✅ Successfully generated insights for {username}")
            
            # --- Save insight to MongoDB ---
            if profiles_collection is not None:
                try:
                    profiles_collection.update_one(
                        {'_id': username},
                        {'$set': {
                            'insight': {
                                'text': insight_text,
                                'generated_at': datetime.datetime.utcnow()
                            }
                        }}
                    )
                    print(f"✅ Saved insight for '{username}' to MongoDB.")
                except Exception as e:
                    print(f"❌ Failed to save insight for '{username}' to MongoDB: {e}")
            # --- End of MongoDB logic ---

            return jsonify({
                'insight': insight_text,
                'profile_summary': {
                    'username': username,
                    'name': profile_data.get('name'),
                    'public_repos': profile_data.get('public_repos', 0),
                    'total_stars': total_stars,
                    'account_age_years': account_age_years,
                    'top_languages': dict(top_languages[:3]),
                    'generated_at': datetime.datetime.now().isoformat()
                }
            })
            
        except Exception as gemini_error:
            print(f"❌ Gemini API error: {gemini_error}")
            return jsonify({'error': f'AI insight generation failed: {str(gemini_error)}'}), 500

    except requests.RequestException as req_error:
        print(f"❌ GitHub API request failed: {req_error}")
        return jsonify({'error': f'GitHub API request failed: {str(req_error)}'}), 500
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return jsonify({'error': f'Insight generation failed: {str(e)}'}), 500




if __name__ == '__main__':
    if not GITHUB_TOKEN:
        print("Warning: GITHUB_TOKEN not found in environment variables. API requests may be rate limited.")
    else:
        print("Starting GitHub Profile Analyzer backend...")
        print(f"Using GitHub token: {GITHUB_TOKEN[:5]}...{GITHUB_TOKEN[-5:]}")
    
    port = int(os.environ.get('PORT', 5000))
    print(f"Server running on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)