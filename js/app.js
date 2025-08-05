// DOM Elements
const usernameInput = document.getElementById('username');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error-message');
const resultsElement = document.getElementById('results');
const activityTimeFilterElement = document.getElementById('activity-time-filter');

// Chart instances
let activityStreamChart = null;


// Backend API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Initialize the application
function init() {
    analyzeBtn.addEventListener('click', handleAnalyzeClick);
    activityTimeFilterElement.addEventListener('change', handleActivityTimeFilterChange);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadPDF);
    
    // Set current year in the GitHub stats
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

// Handle analyze button click
async function handleAnalyzeClick() {
    const input = usernameInput.value.trim();
    
    if (!input) {
        showError('Please enter a GitHub username or profile URL');
        return;
    }
    
    // Extract username from input (handles both direct username or profile URL)
    const username = extractUsername(input);
    
    if (!username) {
        showError('Invalid GitHub username or URL');
        return;
    }
    
    try {
        showLoading();
        await fetchAndDisplayData(username);
    } catch (error) {
        showError(error.message || 'An error occurred while fetching data');
        console.error('Error:', error);
    }
}

// Extract username from input (handles both direct username or profile URL)
function extractUsername(input) {
    // Check if input is a URL
    if (input.includes('github.com')) {
        const urlParts = input.split('/');
        return urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    }
    
    // Otherwise, assume it's a direct username
    return input;
}

// Handle activity time filter change
async function handleActivityTimeFilterChange() {
    const username = extractUsername(usernameInput.value.trim());
    const timeRange = activityTimeFilterElement.value;
    
    if (username) {
        try {
            await updateActivityStream(username, timeRange);
        } catch (error) {
            console.error('Error updating activity stream:', error);
        }
    }
}

// Fetch and display all data
async function fetchAndDisplayData(username) {
    try {
        // Fetch basic profile data
        const profileData = await fetchProfileData(username);
        displayProfileOverview(profileData);
        
        // Fetch repositories data
        const repos = await fetchRepositories(username);
        
        // Fetch aggregated language data
        const languageData = await fetchUserLanguages(username);
        
        // Display language bar using aggregated data
        displayLanguageBar(languageData);
        
        // Fetch and display activity stream with default time range
        const timeRange = activityTimeFilterElement.value;
        await updateActivityStream(username, timeRange);
        

        
        // Display repository metrics
        displayRepositoryMetrics(repos, profileData);
        
        // Display GitHub stats
        displayGitHubStats(username, repos, profileData);
        
        // Generate AI insights
        await generateAIInsights(username, repos, profileData, languageData);
        
        // Show results
        hideLoading();
        resultsElement.classList.remove('hidden');
        document.getElementById('download-container').classList.remove('hidden');
    } catch (error) {
        hideLoading();
        throw error;
    }
}

// Fetch user languages
async function fetchUserLanguages(username) {
    try {
        const response = await fetch(`${API_BASE_URL}/user-languages/${username}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch user languages');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching user languages:', error);
        // Return empty object if there's an error
        return {};
    }
}

// Fetch basic profile data
async function fetchProfileData(username) {
    try {
        const response = await fetch(`${API_BASE_URL}/profile/${username}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`User '${username}' not found`);
            }
            throw new Error('Failed to fetch profile data');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching profile data:', error);
        throw error;
    }
}

// Fetch repositories data
async function fetchRepositories(username) {
    try {
        const response = await fetch(`${API_BASE_URL}/repos/${username}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch repositories');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching repositories:', error);
        throw error;
    }
}

// Update activity stream with time filter
async function updateActivityStream(username, timeRange = '1month') {
    try {
        const response = await fetch(`${API_BASE_URL}/activity/${username}?timeRange=${timeRange}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch activity data');
        }
        
        const activityData = await response.json();
        displayActivityStream(activityData);
    } catch (error) {
        console.error('Error fetching activity data:', error);
    }
}

// Display profile overview
function displayProfileOverview(profileData) {
    document.getElementById('avatar').src = profileData.avatar_url;
    document.getElementById('name').textContent = profileData.name || profileData.login;
    document.getElementById('bio').textContent = profileData.bio || 'No bio available';
    document.getElementById('repos').textContent = profileData.public_repos;
    document.getElementById('followers').textContent = profileData.followers;
    document.getElementById('following').textContent = profileData.following;
    
    // Initialize rating display
    updateProfileRating(0);
}



// Display activity stream
function displayActivityStream(activityData) {
    const ctx = document.getElementById('activity-stream').getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (activityStreamChart) {
        activityStreamChart.destroy();
    }
    
    // Create new chart
    activityStreamChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: activityData.dates,
            datasets: [
                {
                    label: 'Commits',
                    data: activityData.activities.commits,
                    borderColor: '#2ea44f',
                    backgroundColor: 'rgba(46, 164, 79, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Pull Requests',
                    data: activityData.activities.pullRequests,
                    borderColor: '#9c27b0',
                    backgroundColor: 'rgba(156, 39, 176, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Issues',
                    data: activityData.activities.issues,
                    borderColor: '#e91e63',
                    backgroundColor: 'rgba(233, 30, 99, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Recent Activity'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Activity Count'
                    }
                }
            }
        }
    });
}

// Generate colors for charts
function generateColors(count) {
    const colors = [
        '#2ea44f', // GitHub green
        '#9c27b0', // Purple
        '#e91e63', // Pink
        '#03a9f4', // Light Blue
        '#ff9800', // Orange
        '#8bc34a', // Light Green
        '#3f51b5', // Indigo
        '#f44336', // Red
        '#009688', // Teal
        '#ffc107', // Amber
        '#795548', // Brown
        '#607d8b'  // Blue Grey
    ];
    
    // If we need more colors than in our predefined list, generate them
    if (count > colors.length) {
        for (let i = colors.length; i < count; i++) {
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);
            colors.push(`rgb(${r}, ${g}, ${b})`);
        }
    }
    
    return colors.slice(0, count);
}

// Show loading state
function showLoading() {
    errorElement.classList.add('hidden');
    resultsElement.classList.add('hidden');
    loadingElement.classList.remove('hidden');
}

// Hide loading state
function hideLoading() {
    loadingElement.classList.add('hidden');
}

// Show error message
function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    resultsElement.classList.add('hidden');
}



// Display repository metrics
function displayRepositoryMetrics(repos, profileData) {
    const metricsContainer = document.getElementById('repo-metrics');
    metricsContainer.innerHTML = ''; // Clear previous content
    
    // Calculate metrics
    const totalRepos = repos.length;
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
    const totalWatchers = repos.reduce((sum, repo) => sum + repo.watchers_count, 0);
    
    const forkedRepos = repos.filter(repo => repo.fork).length;
    const originalRepos = totalRepos - forkedRepos;
    
    const openIssues = repos.reduce((sum, repo) => sum + repo.open_issues_count, 0);
    
    const avgRepoSize = Math.round(repos.reduce((sum, repo) => sum + repo.size, 0) / totalRepos);
    
    // Calculate repository age statistics
    const repoAges = repos.map(repo => {
        const createdDate = new Date(repo.created_at);
        const now = new Date();
        const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        return ageInDays;
    });
    
    const avgRepoAge = Math.round(repoAges.reduce((sum, age) => sum + age, 0) / totalRepos);
    const oldestRepoAge = Math.max(...repoAges);
    const newestRepoAge = Math.min(...repoAges);
    
    // Account age
    const accountCreatedDate = new Date(profileData.created_at);
    const now = new Date();
    const accountAgeInDays = Math.floor((now - accountCreatedDate) / (1000 * 60 * 60 * 24));
    const accountAgeInYears = (accountAgeInDays / 365).toFixed(1);
    
    // Average repositories created per year
    const reposPerYear = (totalRepos / (accountAgeInDays / 365)).toFixed(1);
    
    // Create metric cards
    const metrics = [
        { title: 'Total Repositories', value: totalRepos, subtitle: `${originalRepos} original, ${forkedRepos} forked` },
        { title: 'Total Stars', value: totalStars, subtitle: `Avg ${(totalStars / Math.max(originalRepos, 1)).toFixed(1)} per original repo` },
        { title: 'Total Forks', value: totalForks, subtitle: `Across all repositories` },
        { title: 'Open Issues', value: openIssues, subtitle: `Across all repositories` },
        { title: 'Average Repo Size', value: `${avgRepoSize} KB`, subtitle: `${(avgRepoSize / 1024).toFixed(2)} MB` },
        { title: 'Average Repo Age', value: `${avgRepoAge} days`, subtitle: `${(avgRepoAge / 365).toFixed(1)} years` },
        { title: 'Oldest Repository', value: `${oldestRepoAge} days`, subtitle: `${(oldestRepoAge / 365).toFixed(1)} years` },
        { title: 'Newest Repository', value: `${newestRepoAge} days`, subtitle: `${(newestRepoAge / 365).toFixed(1)} years` },
        { title: 'Account Age', value: `${accountAgeInDays} days`, subtitle: `${accountAgeInYears} years` },
        { title: 'Repos Per Year', value: reposPerYear, subtitle: `Creation rate` },
        { title: 'Followers Ratio', value: `${(profileData.followers / Math.max(profileData.following, 1)).toFixed(1)}`, subtitle: `${profileData.followers} followers / ${profileData.following} following` },
        { title: 'Engagement Rate', value: `${((totalStars + totalForks) / Math.max(totalRepos, 1)).toFixed(1)}`, subtitle: `(Stars + Forks) / Repos` }
    ];
    
    // Add metric cards to container
    metrics.forEach(metric => {
        const metricCard = document.createElement('div');
        metricCard.className = 'metric-card';
        
        const metricTitle = document.createElement('div');
        metricTitle.className = 'metric-title';
        metricTitle.textContent = metric.title;
        
        const metricValue = document.createElement('div');
        metricValue.className = 'metric-value';
        metricValue.textContent = metric.value;
        
        const metricSubtitle = document.createElement('div');
        metricSubtitle.className = 'metric-subtitle';
        metricSubtitle.textContent = metric.subtitle;
        
        metricCard.appendChild(metricTitle);
        metricCard.appendChild(metricValue);
        metricCard.appendChild(metricSubtitle);
        
        metricsContainer.appendChild(metricCard);
    });
}

// Display language bar
function displayLanguageBar(languages) {
    const languageBar = document.getElementById('language-bar');
    const languageLegend = document.getElementById('language-legend');
    
    if (!languageBar || !languageLegend) {
        console.error('Language bar elements not found');
        return;
    }
    
    // Clear previous content
    languageBar.innerHTML = '';
    languageLegend.innerHTML = '';
    
    // Check if languages data exists
    if (!languages || Object.keys(languages).length === 0) {
        languageBar.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No language data available</div>';
        return;
    }
    
    // Define colors for common languages
    const languageColors = {
        'JavaScript': '#f1e05a',
        'Python': '#3572A5',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'TypeScript': '#2b7489',
        'Java': '#b07219',
        'C++': '#f34b7d',
        'C#': '#178600',
        'PHP': '#4F5D95',
        'Ruby': '#701516',
        'Go': '#00ADD8',
        'Jupyter Notebook': '#DA5B0B',
        'Shell': '#89e051',
        'Swift': '#ffac45',
        'Kotlin': '#A97BFF',
        'Rust': '#dea584'
    };
    
    // Calculate total count
    const totalCount = Object.values(languages).reduce((sum, count) => sum + count, 0);
    
    if (totalCount === 0) {
        languageBar.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No language data available</div>';
        return;
    }
    
    // Sort languages by count (descending)
    const sortedLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1]);
    
    // Create language bar segments
    sortedLanguages.forEach(([language, count]) => {
        const percentage = (count / totalCount) * 100;
        if (percentage < 0.5) return; // Skip very small percentages
        
        const color = languageColors[language] || getRandomColor();
        
        // Create bar segment
        const segment = document.createElement('div');
        segment.className = 'language-segment';
        segment.style.width = `${percentage}%`;
        segment.style.backgroundColor = color;
        segment.style.height = '100%';
        segment.style.display = 'inline-block';
        languageBar.appendChild(segment);
        
        // Create legend item
        const legendItem = document.createElement('div');
        legendItem.className = 'language-item';
        
        const colorBox = document.createElement('span');
        colorBox.className = 'language-color';
        colorBox.style.backgroundColor = color;
        colorBox.style.width = '12px';
        colorBox.style.height = '12px';
        colorBox.style.display = 'inline-block';
        colorBox.style.borderRadius = '2px';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${language} ${count.toLocaleString()} lines (${percentage.toFixed(1)}%)`;
        nameSpan.style.marginLeft = '8px';
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(nameSpan);
        languageLegend.appendChild(legendItem);
    });
}


// Display GitHub stats
function displayGitHubStats(username, _repos, profileData) {
    // Update title with username
    const displayName = profileData.name || username;
    document.getElementById('github-stats-title').textContent = `${displayName}'s GitHub Stats`;
    
    // Get stats from profile data. The backend now provides these.
    const stats = profileData.stats || {};
    
    // Use real data from API or fallback to defaults if not available
    const totalStars = stats.total_stars || 0; // Use backend value
    const totalCommits = stats.commits_current_year || 0;
    const totalPRs = stats.total_prs || 0;
    const totalIssues = stats.total_issues || 0;
    const contributedTo = stats.contributed_to || 0;
    const rating = stats.rating || 0; // Use backend value
    
    // Update stats in the UI
    document.getElementById('total-stars').textContent = totalStars;
    document.getElementById('total-commits').textContent = totalCommits;
    document.getElementById('total-prs').textContent = totalPRs;
    document.getElementById('total-issues').textContent = totalIssues;
    document.getElementById('contributed-to').textContent = contributedTo;
    
    // Update rating in profile overview using the score from the backend
    updateProfileRating(rating);
}
// Update profile rating with enhanced UX
function updateProfileRating(rating) {
    const ratingElement = document.getElementById('profile-rating');
    const progressElement = document.getElementById('rating-progress');
    const descriptionElement = document.getElementById('rating-description');
    
    // Animate rating display
    setTimeout(() => {
        ratingElement.textContent = rating;
        
        // Set color and description based on rating
        let color, description;
        if (rating >= 80) {
            color = '#28a745';
            description = 'Excellent Developer';
        } else if (rating >= 60) {
            color = '#ffc107';
            description = 'Good Developer';
        } else if (rating >= 40) {
            color = '#fd7e14';
            description = 'Average Developer';
        } else if (rating >= 20) {
            color = '#dc3545';
            description = 'Beginner Developer';
        } else {
            color = '#6c757d';
            description = 'New to GitHub';
        }
        
        // Update CSS variables for progress circle
        progressElement.style.setProperty('--rating-color', color);
        progressElement.style.setProperty('--rating-percentage', `${rating}%`);
        descriptionElement.textContent = description;
    }, 300);
}

// Generate random color for languages without predefined colors
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

async function generateAIInsights(username, repos, profileData, languageData) {
    const insightContainer = document.getElementById("insightContainer");
    
    // Show loading state with progress
    if (insightContainer) {
        showInsightProgress(insightContainer);
    }
    
    try {
        // Use the correct API base URL
        const response = await fetch(`${API_BASE_URL}/insights/${username}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.error) {
            console.error("Insight Error:", data.error);
            if (insightContainer) {
                insightContainer.innerHTML = `
                    <div class="insight-error">
                        <h3>⚠️ Insight Generation Failed</h3>
                        <p>${data.error}</p>
                        <button onclick="generateAIInsights('${username}', [], {}, {})" class="retry-btn">
                            Try Again
                        </button>
                    </div>
                `;
                addThemedInsightStyles();
            }
            return;
        }

        // Display the insight in the UI with theme-matching design
        if (insightContainer) {
            const formattedInsight = formatProfessionalInsight(data.insight);
            
            insightContainer.innerHTML = `
                <div class="themed-insight-card">
                    <div class="insight-header-themed">
                        <h2>🤖 AI Career Insights</h2>
                        <p>Personalized analysis for <strong>${username}</strong></p>
                        <span class="gemini-badge">Powered by Gemini AI</span>
                    </div>
                    <div class="insight-content-themed">
                        ${formattedInsight}
                    </div>
                    <div class="insight-footer-themed">
                        <small>Generated based on GitHub profile analysis</small>
                        <button onclick="generateAIInsights('${username}', [], {}, {})" class="refresh-btn-themed">
                            🔄 Refresh Insights
                        </button>
                    </div>
                </div>
            `;
            
            addThemedInsightStyles();
        } else {
            console.warn("Insight container element 'insightContainer' not found in DOM");
        }
        
        // Optional: Log profile summary if available
        if (data.profile_summary) {
            console.log('Profile Summary:', data.profile_summary);
        }
        
    } catch (error) {
        console.error("Fetch error:", error);
        
        // Better error handling - show in UI instead of alert
        if (insightContainer) {
            const errorMessage = error.message.includes('Failed to fetch') 
                ? 'Failed to connect to the server. Please check if the backend is running on http://localhost:5000'
                : error.message;
                
            insightContainer.innerHTML = `
                <div class="insight-error">
                    <h3>❌ Connection Error</h3>
                    <p>${errorMessage}</p>
                    <button onclick="generateAIInsights('${username}', [], {}, {})" class="retry-btn">
                        Try Again
                    </button>
                </div>
            `;
            addThemedInsightStyles();
        }
    }
}

// Format Gemini response with professional structure
function formatProfessionalInsight(insight) {
    const sections = insight.split(/\n\n+/);
    let formattedContent = '';
    let sectionCount = 0;
    
    const sectionIcons = ['📊', '💼', '⭐', '🎯', '📈'];
    
    sections.forEach(section => {
        if (!section.trim()) return;
        
        // Check for section headers
        if (section.match(/^\*\*\d+\./)) {
            const headerMatch = section.match(/^\*\*(\d+\. [^*]+)\*\*(.*)$/s);
            if (headerMatch) {
                const [, header, content] = headerMatch;
                const icon = sectionIcons[sectionCount] || '📋';
                sectionCount++;
                
                formattedContent += `
                    <div class="professional-section">
                        <div class="section-header-pro">
                            <div class="section-icon">${icon}</div>
                            <h3>${header.substring(header.indexOf('.') + 1).trim()}</h3>
                        </div>
                        <div class="section-body">${formatProfessionalContent(content)}</div>
                    </div>
                `;
            }
        } else if (section.startsWith('**') && section.endsWith('**')) {
            // Standalone headers
            const header = section.replace(/\*\*/g, '');
            const icon = sectionIcons[sectionCount] || '📋';
            sectionCount++;
            formattedContent += `
                <div class="professional-section">
                    <div class="section-header-pro">
                        <div class="section-icon">${icon}</div>
                        <h3>${header}</h3>
                    </div>
                    <div class="section-body"></div>
                </div>
            `;
        } else {
            // Regular content without header
            formattedContent += `<div class="content-paragraph">${formatProfessionalContent(section)}</div>`;
        }
    });
    
    return formattedContent;
}

// Format professional content with enhanced styling
function formatProfessionalContent(content) {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>')
        .replace(/^- (.+)$/gm, '<li class="insight-item">$1</li>')
        .replace(/^\* (.+)$/gm, '<li class="insight-item">$1</li>')
        .replace(/(<li class="insight-item">.*<\/li>)/gs, '<ul class="insight-list">$1</ul>')
        .replace(/\n/g, '<br>')
        .trim();
}

// Add themed CSS styles for insights matching page design
function addThemedInsightStyles() {
    if (document.getElementById('themed-insight-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'themed-insight-styles';
    style.textContent = `
        .themed-insight-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            transition: all 0.3s ease;
            animation: fadeInUp 0.6s ease-out both;
        }
        
        .themed-insight-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
        }
        
        .insight-header-themed {
            text-align: center;
            margin-bottom: 25px;
            position: relative;
        }
        
        .insight-header-themed h2 {
            font-size: 1.8rem;
            font-weight: 600;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .insight-header-themed p {
            color: #666;
            font-size: 1.1rem;
            margin-bottom: 15px;
        }
        
        .gemini-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        }
        
        .insight-content-themed {
            line-height: 1.6;
            margin: 25px 0;
        }
        
        .professional-section {
            margin-bottom: 20px;
            background: linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%);
            border-radius: 15px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        
        .section-header-pro {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 15px;
        }
        
        .section-icon {
            font-size: 20px;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .section-header-pro h3 {
            margin: 0;
            font-size: 1.3rem;
            font-weight: 600;
            color: #333;
        }
        
        .section-body {
            font-size: 1rem;
            line-height: 1.6;
            color: #555;
        }
        
        .insight-list {
            margin: 12px 0;
            padding-left: 20px;
        }
        
        .insight-item {
            margin: 8px 0;
            color: #555;
        }
        
        .highlight {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
        }
        
        .content-paragraph {
            margin-bottom: 16px;
            padding: 15px;
            background: rgba(102, 126, 234, 0.05);
            border-radius: 10px;
            border-left: 3px solid #667eea;
            color: #555;
        }
        
        .insight-footer-themed {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid rgba(102, 126, 234, 0.2);
        }
        
        .insight-footer-themed small {
            color: #666;
            font-size: 0.9rem;
        }
        
        .refresh-btn-themed {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .refresh-btn-themed:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        
        .loading-insight {
            text-align: center;
            padding: 40px;
            color: #667eea;
            font-style: italic;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 15px;
            border: 2px dashed rgba(102, 126, 234, 0.3);
        }
        
        .insight-error {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
        }
        
        .retry-btn {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            margin-top: 15px;
            transition: all 0.3s ease;
        }
        
        .retry-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }
    `;
    document.head.appendChild(style);
}


// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Show insight generation progress
function showInsightProgress(container) {
    let progress = 0;
    container.innerHTML = `
        <div class="loading-insight">
            <div class="progress-container">
                <div class="ai-thinking">🤖 AI is analyzing your profile...</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <div class="progress-text" id="progress-text">Initializing...</div>
            </div>
        </div>
    `;
    
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const messages = [
        'Analyzing repositories...',
        'Processing language data...',
        'Generating insights...',
        'Finalizing analysis...'
    ];
    
    const interval = setInterval(() => {
        progress += 25;
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText && messages[Math.floor(progress/25) - 1]) {
            progressText.textContent = messages[Math.floor(progress/25) - 1];
        }
        if (progress >= 100) clearInterval(interval);
    }, 3000);
}
// Download PDF report function
async function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const username = extractUsername(usernameInput.value.trim());
    
    // PDF styling
    const primaryColor = [102, 126, 234];
    const pageHeight = 297;
    const marginBottom = 30;
    let currentPage = 1;
    
    // Function to add header to each page
    function addHeader(pageNum) {
        pdf.setFillColor(...primaryColor);
        pdf.rect(0, 0, 210, 40, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SMARRTIF AI', 20, 20);
        
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('GitHub Profile Analysis Report', 20, 32);
        
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1);
        pdf.rect(160, 8, 40, 24);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.text('SMARRTIF', 170, 18);
        pdf.text('AI', 180, 26);
        
        pdf.setFontSize(8);
        pdf.text(`Page ${pageNum}`, 185, 35);
    }
    
    // Function to check if new page is needed
    function checkNewPage(yPos, requiredSpace = 20) {
        if (yPos + requiredSpace > pageHeight - marginBottom) {
            pdf.addPage();
            currentPage++;
            addHeader(currentPage);
            return 50;
        }
        return yPos;
    }
    
    addHeader(currentPage);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Profile: ${username}`, 20, 55);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 65);
    
    let yPos = 80;
    
    // Profile Overview
    yPos = checkNewPage(yPos, 40);
    const name = document.getElementById('name').textContent;
    const bio = document.getElementById('bio').textContent;
    const repos = document.getElementById('repos').textContent;
    const followers = document.getElementById('followers').textContent;
    const following = document.getElementById('following').textContent;
    const rating = document.getElementById('profile-rating').textContent;
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Profile Overview', 20, yPos);
    yPos += 10;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Name: ${name}`, 20, yPos);
    yPos += 6;
    
    const bioLines = pdf.splitTextToSize(`Bio: ${bio}`, 170);
    bioLines.forEach(line => {
        yPos = checkNewPage(yPos, 6);
        pdf.text(line, 20, yPos);
        yPos += 6;
    });
    
    pdf.text(`Repositories: ${repos} | Followers: ${followers} | Following: ${following}`, 20, yPos);
    yPos += 6;
    pdf.text(`Rating: ${rating}/100`, 20, yPos);
    yPos += 15;
    
    // GitHub Stats
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('GitHub Statistics', 20, yPos);
    yPos += 10;
    
    const totalStars = document.getElementById('total-stars').textContent;
    const totalCommits = document.getElementById('total-commits').textContent;
    const totalPRs = document.getElementById('total-prs').textContent;
    const totalIssues = document.getElementById('total-issues').textContent;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Stars: ${totalStars}`, 20, yPos);
    yPos += 6;
    pdf.text(`Total Commits (${new Date().getFullYear()}): ${totalCommits}`, 20, yPos);
    yPos += 6;
    pdf.text(`Total Pull Requests: ${totalPRs}`, 20, yPos);
    yPos += 6;
    pdf.text(`Total Issues: ${totalIssues}`, 20, yPos);
    yPos += 15;
    
    // Languages
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Most Used Languages', 20, yPos);
    yPos += 10;
    
    const languageItems = document.querySelectorAll('.language-item span:last-child');
    languageItems.forEach((item, index) => {
        if (index < 5) { // Top 5 languages
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`• ${item.textContent}`, 25, yPos);
            yPos += 6;
        }
    });
    
    yPos += 10;
    
    // AI Insights
    yPos = checkNewPage(yPos, 30);
    const insightContainer = document.querySelector('.themed-insight-card .insight-content-themed');
    if (insightContainer) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('AI Career Insights', 20, yPos);
        yPos += 10;
        
        const fullText = insightContainer.textContent
            .replace(/\s+/g, ' ')
            .replace(/📊|💼|⭐|🎯|📈/g, '')
            .trim();
        
        if (fullText) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            const lines = pdf.splitTextToSize(fullText, 170);
            
            lines.forEach(line => {
                yPos = checkNewPage(yPos, 4);
                pdf.text(line, 20, yPos);
                yPos += 4;
            });
        }
    }
    
    // Add footer to all pages
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, 270, 210, 27, 'F');
        
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.text('This report is digitally signed and generated by SMARRTIF AI', 20, 285);
        pdf.text('GitHub Profile Analyzer - Comprehensive Developer Analysis', 20, 290);
        
        pdf.setDrawColor(...primaryColor);
        pdf.setLineWidth(1);
        pdf.rect(140, 275, 60, 15);
        pdf.setTextColor(...primaryColor);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SMARRTIF AI', 150, 285);
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Digitally Verified', 145, 288);
    }
    
    // Save PDF
    pdf.save(`${username}_github_analysis_report.pdf`);
    console.log(`PDF generated with ${totalPages} page(s)`);
}