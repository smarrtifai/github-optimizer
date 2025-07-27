const usernameInput = document.getElementById('usernameInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusDiv = document.getElementById('status');
const insightOutput = document.getElementById('insightOutput');

// Base URL for backend (update if deployed)
const API_BASE_URL = 'http://localhost:5000';

async function generateAIInsights(username) {
  try {
    statusDiv.textContent = "🔄 Generating insights...";
    insightOutput.textContent = "";

    const response = await fetch(`${API_BASE_URL}/api/insights/${username}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "API returned error");
    }

    const data = await response.json();

    // Render insight and summary
    insightOutput.innerHTML = `
      <h3>🔍 Insight Report for ${data.profile_summary.name || username}</h3>
      <p><strong>Top Languages:</strong> ${Object.entries(data.profile_summary.top_languages || {}).map(([lang, count]) => `${lang} (${count})`).join(', ')}</p>
      <p><strong>Account Age:</strong> ${data.profile_summary.account_age_years} years</p>
      <hr />
      <pre>${data.insight}</pre>
    `;
    statusDiv.textContent = "✅ Analysis complete!";
  } catch (err) {
    statusDiv.textContent = "❌ " + err.message;
    console.error(err);
  }
}

analyzeBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username) {
    generateAIInsights(username);
  } else {
    statusDiv.textContent = "⚠️ Please enter a GitHub username.";
  }
});
