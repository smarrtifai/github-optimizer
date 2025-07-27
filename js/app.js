// DOM Elements
const usernameInput = document.getElementById('username');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error-message');
const resultsElement = document.getElementById('results');
const timeFilterElement = document.getElementById('time-filter');

// Chart instances
let commitTimelineChart = null;
let repoLanguagesChart = null;
let commitLanguagesChart = null;
let activityStreamChart = null;


// Backend API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Initialize the application
function init() {
    analyzeBtn.addEventListener('click', handleAnalyzeClick);
    timeFilterElement.addEventListener('change', handleTimeFilterChange);
    
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

// Handle time filter change
async function handleTimeFilterChange() {
    const username = extractUsername(usernameInput.value.trim());
    const timeRange = timeFilterElement.value;
    
    if (username) {
        try {
            await updateCommitTimeline(username, timeRange);
        } catch (error) {
            console.error('Error updating commit timeline:', error);
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
        
        // Process and display language distributions
        const processedLanguageData = await processLanguageData(username, repos);
        displayLanguageDistributions(processedLanguageData);
        
        // Display language bar using aggregated data
        displayLanguageBar(languageData);
        
        // Fetch and display commit timeline
        const timeRange = timeFilterElement.value;
        await updateCommitTimeline(username, timeRange);
        
        // Fetch and display activity stream
        await updateActivityStream(username);
        

        
        // Display repository metrics
        displayRepositoryMetrics(repos, profileData);
        
        // Display GitHub stats
        displayGitHubStats(username, repos, profileData);
        
        // Generate AI insights
        await generateAIInsights(username, repos, profileData, languageData);
        
        // Show results
        hideLoading();
        resultsElement.classList.remove('hidden');
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

// Process language data from repositories
async function processLanguageData(username, repos) {
    try {
        const repoLanguages = {};
        const commitLanguages = {};
        
        // Process repository languages
        for (const repo of repos) {
            if (repo.language) {
                repoLanguages[repo.language] = (repoLanguages[repo.language] || 0) + 1;
            }
            
            // For more detailed language breakdown, we would need to fetch languages for each repo
            if (!repo.fork && repo.name) {  // Only count languages in non-forked repos for commit distribution
                try {
                    const response = await fetch(`${API_BASE_URL}/languages/${username}/${repo.name}`);
                    
                    if (response.ok) {
                        const languages = await response.json();
                        
                        for (const [lang, bytes] of Object.entries(languages)) {
                            commitLanguages[lang] = (commitLanguages[lang] || 0) + bytes;
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching languages for ${repo.name}:`, error);
                    // Still add the main language if available
                    if (repo.language) {
                        commitLanguages[repo.language] = (commitLanguages[repo.language] || 0) + 1000; // Arbitrary byte count
                    }
                }
            }
        }
        
        // If no languages were found, provide some default data
        if (Object.keys(repoLanguages).length === 0) {
            repoLanguages['JavaScript'] = 1;
        }
        
        if (Object.keys(commitLanguages).length === 0) {
            commitLanguages['JavaScript'] = 1000;
        }
        
        return {
            repoLanguages,
            commitLanguages
        };
    } catch (error) {
        console.error('Error processing language data:', error);
        throw error;
    }
}

// Update commit timeline based on selected time range
async function updateCommitTimeline(username, timeRange) {
    try {
        const response = await fetch(`${API_BASE_URL}/commits/${username}?timeRange=${timeRange}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch commit data');
        }
        
        const commitData = await response.json();
        displayCommitTimeline(commitData);
    } catch (error) {
        console.error('Error fetching commit data:', error);
    }
}

// Update activity stream
async function updateActivityStream(username) {
    try {
        const response = await fetch(`${API_BASE_URL}/activity/${username}`);
        
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

// Display language distributions
function displayLanguageDistributions(languageData) {
    // Prepare data for repository languages chart
    const repoLabels = Object.keys(languageData.repoLanguages);
    const repoData = Object.values(languageData.repoLanguages);
    
    // Prepare data for commit languages chart
    const commitLabels = Object.keys(languageData.commitLanguages);
    const commitData = Object.values(languageData.commitLanguages);
    
    // Display repository languages chart
    displayPieChart('repo-languages', repoLabels, repoData, 'Repository Languages');
    
    // Display commit languages chart
    displayPieChart('commit-languages', commitLabels, commitData, 'Commit Languages (by bytes)');
}

// Display commit timeline
function displayCommitTimeline(commitData) {
    const ctx = document.getElementById('commit-timeline').getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (commitTimelineChart) {
        commitTimelineChart.destroy();
    }
    
    // Create new chart
    commitTimelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: commitData.dates,
            datasets: [{
                label: 'Commits',
                data: commitData.counts,
                borderColor: '#2ea44f',
                backgroundColor: 'rgba(46, 164, 79, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Commit Activity'
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
                        text: 'Commit Count'
                    }
                }
            }
        }
    });
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

// Display pie chart
function displayPieChart(elementId, labels, data, title) {
    const ctx = document.getElementById(elementId).getContext('2d');
    
    // Generate colors for each segment
    const colors = generateColors(labels.length);
    
    // Destroy previous chart instance if it exists
    if (window[elementId + 'Chart']) {
        window[elementId + 'Chart'].destroy();
    }
    
    // Create new chart
    window[elementId + 'Chart'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
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
    
    // Clear previous content
    languageBar.innerHTML = '';
    languageLegend.innerHTML = '';
    
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
        languageBar.appendChild(segment);
        
        // Create legend item
        const legendItem = document.createElement('div');
        legendItem.className = 'language-item';
        
        const colorBox = document.createElement('span');
        colorBox.className = 'language-color';
        colorBox.style.backgroundColor = color;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${language} ${percentage.toFixed(2)}%`;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(nameSpan);
        languageLegend.appendChild(legendItem);
    });
}

// Display GitHub stats
function displayGitHubStats(username, repos, profileData) {
    // Update title with username
    const displayName = profileData.name || username;
    document.getElementById('github-stats-title').textContent = `${displayName}'s GitHub Stats`;
    
    // Calculate total stars from repositories
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    
    // Get stats from profile data if available
    const stats = profileData.stats || {};
    const currentYear = new Date().getFullYear();
    
    // Use real data from API or fallback to defaults if not available
    const totalCommits = stats.commits_current_year || 0;
    const totalPRs = stats.total_prs || 0;
    const totalIssues = stats.total_issues || 0;
    const contributedTo = stats.contributed_to || 0;
    
    // Update stats in the UI
    document.getElementById('total-stars').textContent = totalStars;
    document.getElementById('total-commits').textContent = totalCommits;
    document.getElementById('total-prs').textContent = totalPRs;
    document.getElementById('total-issues').textContent = totalIssues;
    document.getElementById('contributed-to').textContent = contributedTo;
    
    // Calculate and update rating in profile overview
    const rating = calculateRating(totalStars, totalCommits, totalPRs, contributedTo);
    updateProfileRating(rating);
}

// Calculate rating score out of 100 with improved algorithm
function calculateRating(stars, commits, prs, contributions) {
    // Enhanced scoring algorithm
    const starScore = Math.min(30, stars * 0.8);
    const commitScore = Math.min(25, commits * 0.15);
    const prScore = Math.min(25, prs * 1.2);
    const contributionScore = Math.min(20, contributions * 3);
    
    const totalScore = Math.round(starScore + commitScore + prScore + contributionScore);
    return Math.max(0, Math.min(100, totalScore));
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
    
    // Show loading state for insights
    if (insightContainer) {
        insightContainer.innerHTML = '<div class="loading-insight">🤖 Generating AI insights...</div>';
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
            }
            return;
        }

        // Display the insight in the UI with better formatting
        if (insightContainer) {
            // Convert markdown-style formatting to HTML
            let formattedInsight = data.insight
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/^\* (.*$)/gim, '<li>$1</li>') // List items
                .replace(/^- (.*$)/gim, '<li>$1</li>') // List items
                .replace(/\n\n/g, '</p><p>') // Paragraphs
                .replace(/^(.*:)$/gim, '<h4>$1</h4>'); // Headers
            
            // Wrap in paragraphs if not already wrapped
            if (!formattedInsight.includes('<p>')) {
                formattedInsight = '<p>' + formattedInsight + '</p>';
            }
            
            // Wrap lists in ul tags
            formattedInsight = formattedInsight.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
            
            insightContainer.innerHTML = `
                <div class="ai-insight">
                    <div class="insight-header">
                        <h3>🤖 AI Career Insights</h3>
                        <span class="insight-badge">Powered by Gemini AI</span>
                    </div>
                    <div class="insight-content">
                        ${formattedInsight}
                    </div>
                    <div class="insight-footer">
                        <small>Generated based on GitHub profile analysis</small>
                        <button onclick="generateAIInsights('${username}', [], {}, {})" class="refresh-btn">
                            🔄 Refresh Insights
                        </button>
                    </div>
                </div>
            `;
            
            // Add some CSS classes for styling
            addInsightStyles();
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
        }
    }
}

// Add CSS styles for insights (call this once)
function addInsightStyles() {
    if (document.getElementById('insight-styles')) return; // Already added
    
    const style = document.createElement('style');
    style.id = 'insight-styles';
    style.textContent = `
        .ai-insight {
            background: linear-gradient(135deg, #be4e52ff 0%, #da4f54ff 100%);
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            color: white;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .insight-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            padding-bottom: 10px;
        }
        
        .insight-badge {
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .insight-content {
            line-height: 1.6;
            margin: 15px 0;
        }
        
        .insight-content h4 {
            color: #ffffff;
            margin: 15px 0 8px 0;
            font-size: 16px;
        }
        
        .insight-content ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .insight-content li {
            margin: 5px 0;
        }
        
        .insight-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.2);
        }
        
        .refresh-btn, .retry-btn {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.3s ease;
        }
        
        .refresh-btn:hover, .retry-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }
        
        .loading-insight {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }
        
        .insight-error {
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            color: #c33;
        }
        
        .insight-error h3 {
            margin: 0 0 10px 0;
            color: #a00;
        }
    `;
    document.head.appendChild(style);
}


// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);