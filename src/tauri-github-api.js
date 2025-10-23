// tauri-github-api.js
class TauriGitHubAPI {
    constructor(accessToken = null) {
        this.baseURL = 'https://api.github.com';
        this.token = accessToken;
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoSpace-IDE',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        return response.json();
    }

    async searchRepositories(query, page = 1) {
        return this.makeRequest(`/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=30&page=${page}`);
    }

    async getRepository(owner, repo) {
        return this.makeRequest(`/repos/${owner}/${repo}`);
    }
}
