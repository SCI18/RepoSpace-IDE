import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

class TauriOAuth {
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = 'http://localhost:3000/callback';
        this.authWindow = null;
    }

    getAuthURL() {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: 'repo user',
            state: 'repospace-auth-' + Math.random().toString(36)
        });
        
        return `https://github.com/login/oauth/authorize?${params}`;
    }

    async startOAuth() {
        try {
            const authUrl = this.getAuthURL();
            
            await invoke('open_oauth_window', { url: authUrl });
            
            const unlisten = await listen('oauth_callback', (event) => {
                const callbackUrl = event.payload.url;
                this.handleOAuthCallback(callbackUrl);
                unlisten();
            });

            return new Promise((resolve, reject) => {
                this.authPromise = { resolve, reject };
            });
            
        } catch (error) {
            throw new Error(`OAuth initialization failed: ${error.message}`);
        }
    }

    async handleOAuthCallback(callbackUrl) {
        try {
            const url = new URL(callbackUrl);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            
            if (error) {
                throw new Error(`OAuth error: ${error}`);
            }
            
            if (!code) {
                throw new Error('No authorization code received');
            }
            
            const tokenData = await this.exchangeCodeForToken(code);
            
            if (this.authPromise) {
                this.authPromise.resolve(tokenData.access_token);
            }
            
        } catch (error) {
            if (this.authPromise) {
                this.authPromise.reject(error);
            }
        }
    }

    async exchangeCodeForToken(code) {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'RepoSpace-IDE'
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                redirect_uri: this.redirectUri
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(`OAuth error: ${data.error_description || data.error}`);
        }
        
        return data;
    }

    async getUserInfo(accessToken) {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'RepoSpace-IDE'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get user info: ${response.status}`);
        }
        
        return response.json();
    }
}
