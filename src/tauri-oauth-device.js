// tauri-oauth-device.js - CORS-free GitHub OAuth Device Flow
class TauriOAuthDevice {
    constructor(clientId) {
        this.clientId = clientId;
        this.invoke = window.__TAURI__.core.invoke;
        this.pollInterval = null;
        this.userCodeCallback = null;
    }

    async startDeviceFlow() {
        try {
            const deviceData = await this.requestDeviceCode();
            
            console.log('📱 Device Flow Started');
            console.log('👉 User Code:', deviceData.user_code);
            console.log('🔗 Verification URL:', deviceData.verification_uri);

            this.displayUserCode(deviceData.user_code, deviceData.verification_uri);
            
            await this.invoke('open_oauth_window', { 
                url: deviceData.verification_uri 
            });

            const token = await this.pollForToken(
                deviceData.device_code, 
                deviceData.interval || 5
            );

            console.log('✅ Authentication successful!');
            
            if (this.userCodeCallback) {
                this.userCodeCallback(null);
            }
            
            return token;

        } catch (error) {
            console.error('❌ Device flow failed:', error);
            
            if (this.userCodeCallback) {
                this.userCodeCallback(null);
            }
            
            throw error;
        }
    }

    async requestDeviceCode() {
        try {
            const result = await this.invoke('github_device_code', {
                clientId: this.clientId
            });
            
            return result;
        } catch (error) {
            throw new Error(`Device code request failed: ${error}`);
        }
    }

    async pollForToken(deviceCode, interval) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes with 5 second intervals

            const poll = async () => {
                attempts++;
                
                if (attempts > maxAttempts) {
                    clearInterval(this.pollInterval);
                    reject(new Error('OAuth timeout - authorization took too long'));
                    return;
                }

                try {
                    const data = await this.invoke('github_poll_token', {
                        clientId: this.clientId,
                        deviceCode: deviceCode
                    });

                    if (data.access_token) {
                        clearInterval(this.pollInterval);
                        resolve(data.access_token);
                    } else if (data.error === 'authorization_pending') {
                        console.log(`⏳ Waiting for user authorization... (${attempts}/${maxAttempts})`);
                    } else if (data.error === 'slow_down') {
                        clearInterval(this.pollInterval);
                        const newInterval = (interval + 5) * 1000;
                        console.log(`⏱️ Slowing down polling to ${newInterval/1000}s`);
                        this.pollInterval = setInterval(poll, newInterval);
                    } else if (data.error === 'expired_token') {
                        clearInterval(this.pollInterval);
                        reject(new Error('Device code expired - please try again'));
                    } else if (data.error === 'access_denied') {
                        clearInterval(this.pollInterval);
                        reject(new Error('Access denied by user'));
                    } else if (data.error) {
                        clearInterval(this.pollInterval);
                        reject(new Error(`OAuth error: ${data.error_description || data.error}`));
                    }

                } catch (error) {
                    clearInterval(this.pollInterval);
                    reject(error);
                }
            };

            this.pollInterval = setInterval(poll, interval * 1000);
            poll();
        });
    }

    displayUserCode(userCode, verificationUri) {
        const formattedCode = userCode.match(/.{1,4}/g)?.join('-') || userCode;
        
        if (this.userCodeCallback) {
            this.userCodeCallback({
                code: formattedCode,
                originalCode: userCode,
                uri: verificationUri
            });
        }
    }

    onUserCode(callback) {
        this.userCodeCallback = callback;
    }

    async getUserInfo(accessToken) {
        try {
            const user = await this.invoke('github_get_user', {
                accessToken: accessToken
            });
            
            return user;
        } catch (error) {
            throw new Error(`Failed to get user info: ${error}`);
        }
    }

    cancel() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
}

window.TauriOAuthDevice = TauriOAuthDevice;
