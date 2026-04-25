const API_BASE = 'http://localhost:8000';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function loadCards() {
  try {
    const [health, conflicts] = await Promise.all([
      fetchJson('/metrics/context-health'),
      fetchJson('/conflicts'),
    ]);

    document.getElementById('health').textContent = JSON.stringify(health, null, 2);
    document.getElementById('conflicts').textContent = JSON.stringify(conflicts, null, 2);
  } catch (error) {
    const message = `Unable to reach API: ${error.message}`;
    document.getElementById('health').textContent = message;
    document.getElementById('conflicts').textContent = message;
  }
}

async function runQuery() {
  const text = document.getElementById('queryInput').value.trim();
  if (!text) {
    return;
  }

  try {
    const result = await fetchJson('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    document.getElementById('queryResult').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    document.getElementById('queryResult').textContent = `Query failed: ${error.message}`;
  }
}

document.getElementById('queryBtn').addEventListener('click', runQuery);
loadCards();
