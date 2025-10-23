// repo-downloader.js - GitHub Repository Download Manager
class RepoDownloader {
    constructor() {
        this.invoke = window.__TAURI__?.core?.invoke;
        this.fs = window.__TAURI__?.fs;
        this.path = window.__TAURI__?.path;
        this.dialog = window.__TAURI__?.dialog;
        this.event = window.__TAURI__?.event;
        this.downloadedRepos = this.loadDownloadedRepos();
    }

    loadDownloadedRepos() {
        try {
            return JSON.parse(localStorage.getItem('downloaded_repos') || '[]');
        } catch (error) {
            console.error('Failed to load downloaded repos:', error);
            return [];
        }
    }

    saveDownloadedRepos() {
        localStorage.setItem('downloaded_repos', JSON.stringify(this.downloadedRepos));
    }

    async getRepoInfo(owner, repo, accessToken = null) {
        try {
            const info = await this.invoke('get_repo_info', {
                owner,
                repo,
                accessToken
            });
            return info;
        } catch (error) {
            console.error('Failed to get repo info:', error);
            throw error;
        }
    }

    async getRepoBranches(owner, repo, accessToken = null) {
        try {
            const branches = await this.invoke('get_repo_branches', {
                owner,
                repo,
                accessToken
            });
            return branches;
        } catch (error) {
            console.error('Failed to get branches:', error);
            throw error;
        }
    }

    async downloadRepo(owner, repo, branch = 'main', savePath = null, progressCallback = null) {
        try {
            console.log(`📥 Starting download: ${owner}/${repo} (${branch})`);
            
            if (progressCallback) {
                progressCallback({ stage: 'preparing', progress: 0 });
            }

            let downloadsPath;
            
            if (savePath) {
                downloadsPath = savePath;
            } else {
                // Ask user where to save
                const selectedPath = await this.dialog.open({
                    directory: true,
                    title: `Choose where to save ${owner}/${repo}`,
                    defaultPath: await this.path.homeDir()
                });
                
                if (!selectedPath) {
                    throw new Error('Download cancelled by user');
                }
                
                downloadsPath = selectedPath;
            }

            console.log('📁 Save location:', downloadsPath);

            const unlisten = await this.event.listen('download_progress', (event) => {
                console.log('Progress event:', event.payload);
                if (progressCallback) {
                    progressCallback(event.payload);
                }
            });

            try {
                await this.fs.mkdir(downloadsPath, { recursive: true });
            } catch (e) {
                // Directory might already exist, ignore error
            }

            if (progressCallback) {
                progressCallback({ stage: 'downloading', progress: 5 });
            }

            const zipPath = await this.invoke('download_repo_zip', {
                owner,
                repo,
                branch,
                savePath: downloadsPath
            });

            console.log(`✅ Downloaded to: ${zipPath}`);

            const extractPath = `${downloadsPath}/${repo}-${branch}`;
            const extractedPath = await this.invoke('extract_zip', {
                zipPath,
                extractTo: extractPath
            });

            console.log(`✅ Extracted to: ${extractedPath}`);

            if (progressCallback) {
                progressCallback({ stage: 'completing', progress: 98 });
            }
            unlisten();

            const repoEntry = {
                owner,
                repo,
                branch,
                fullName: `${owner}/${repo}`,
                zipPath,
                extractedPath,
                savePath: downloadsPath,
                downloadedAt: Date.now(),
                downloadedDate: new Date().toISOString()
            };

            this.downloadedRepos = this.downloadedRepos.filter(
                r => r.fullName !== repoEntry.fullName || r.branch !== branch
            );

            this.downloadedRepos.unshift(repoEntry);
            this.saveDownloadedRepos();

            if (progressCallback) {
                progressCallback({ stage: 'done', progress: 100 });
            }

            console.log('✅ Download complete!');
            console.log('📂 Location:', extractedPath);
            
            return repoEntry;

        } catch (error) {
            console.error('❌ Download failed:', error);
            throw error;
        }
    }

    getDownloadedRepos() {
        return this.downloadedRepos;
    }

    removeDownloadedRepo(fullName, branch) {
        this.downloadedRepos = this.downloadedRepos.filter(
            r => r.fullName !== fullName || r.branch !== branch
        );
        this.saveDownloadedRepos();
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return mins <= 1 ? 'Just now' : `${mins} minutes ago`;
        }

        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }

        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }

        return date.toLocaleDateString();
    }
}

window.RepoDownloader = RepoDownloader;
