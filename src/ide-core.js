// ide-core.js - RepoSpace IDE Core Functionality

class RepoSpaceIDE {
    constructor() {
        this.editor = null;
        this.terminal = null;
        this.openTabs = new Map();
        this.activeTab = null;
        this.fileSystem = new TauriFileSystem();
        this.recentFiles = new RecentFilesManager();
        this.currentProject = null;
        this.repoDownloader = new RepoDownloader();
        this.oauth = new TauriOAuthDevice('Ov23liPBT9D5BFUzBrYB');
        this.githubToken = localStorage.getItem('github_token');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('🚀 Initializing RepoSpace IDE...');

        this.cacheElements();

        await this.initializeEditor();
        this.initializeTerminal();
        this.setupEventListeners();
        this.initializeTheme();

        if (this.githubToken) {
            try {
                const user = await this.oauth.getUserInfo(this.githubToken);
                this.updateUserInfo(user);
                console.log('✅ Already logged in as:', user.login);
            } catch (error) {
                console.log('⚠️ Stored token is invalid, clearing...');
                localStorage.removeItem('github_token');
                this.githubToken = null;
            }
        }

        console.log('✅ RepoSpace IDE initialized successfully!');
    }

    cacheElements() {
        this.elements = {
            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.getElementById('themeIcon'),
            loginBtn: document.getElementById('loginBtn'),
            userInfo: document.getElementById('userInfo'),
            recentFilesBtn: document.getElementById('recentFilesBtn'),
            repoSearchInput: document.getElementById('repoSearchInput'),
            repoSearchBtn: document.getElementById('repoSearchBtn'),
            repoResults: document.getElementById('repoResults'),
            extensionSearchInput: document.getElementById('extensionSearchInput'),
            extensionResults: document.getElementById('extensionResults'),
            fileTree: document.getElementById('fileTree'),
            terminalContainer: document.getElementById('terminalContainer'),
            clearTerminalBtn: document.getElementById('clearTerminalBtn'),
            toggleTerminalBtn: document.getElementById('toggleTerminalBtn'),
            editorContainer: document.getElementById('editorContainer'),
            tabBar: document.getElementById('tabBar'),
            saveBtn: document.getElementById('saveBtn'),
            formatBtn: document.getElementById('formatBtn'),
            lineCol: document.getElementById('lineCol'),
            fileEncoding: document.getElementById('fileEncoding'),
            gitStatus: document.getElementById('gitStatus'),
            languageMode: document.getElementById('languageMode'),
            aiStatus: document.getElementById('aiStatus')
        };
    }

    async initializeEditor() {
        try {
            console.log('📝 Initializing Monaco Editor...');

            return new Promise((resolve, reject) => {
                require.config({
                    paths: {
                        vs: './vendor/vs'
                    }
                });

                require(['vs/editor/editor.main'], () => {
                    try {
                        this.elements.editorContainer.innerHTML = '';

                        this.editor = monaco.editor.create(this.elements.editorContainer, {
                            value: '# Welcome to RepoSpace IDE\n\nOpen a file to start editing!',
                            language: 'markdown',
                            theme: document.body.classList.contains('dark-theme') ? 'vs-dark' : 'vs',
                            automaticLayout: true,
                            fontSize: 16,
                            minimap: { enabled: true },
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            lineNumbers: 'on',
                            renderWhitespace: 'selection',
                            folding: true,
                            matchBrackets: 'always',
                            autoIndent: 'full'
                        });

                        console.log('✅ Monaco Editor initialized');
                        resolve();
                    } catch (error) {
                        console.error('❌ Failed to create editor:', error);
                        reject(error);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Failed to initialize Monaco Editor:', error);
        }
    }

    initializeTerminal() {
        try {
            console.log('💻 Initializing Custom Terminal...');

            this.terminal = new RepoSpaceTerminal('terminalContainer');

            const isDark = document.body.classList.contains('dark-theme');
            this.terminal.setTheme(isDark);

            console.log('✅ Custom Terminal initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Custom Terminal:', error);
            this.elements.terminalContainer.innerHTML = `
                <div style="padding: 16px; color: #ff4444;">
                    <div>❌ Custom Terminal failed to load</div>
                    <div>Error: ${error.message}</div>
                </div>
            `;
        }
    }

    setupEventListeners() {
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        if (this.elements.repoSearchBtn) {
            this.elements.repoSearchBtn.addEventListener('click', () => this.searchRepositories());
        }

        if (this.elements.repoSearchInput) {
            this.elements.repoSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchRepositories();
                }
            });
        }

        if (this.elements.clearTerminalBtn) {
            this.elements.clearTerminalBtn.addEventListener('click', () => this.clearTerminal());
        }

        if (this.elements.toggleTerminalBtn) {
            this.elements.toggleTerminalBtn.addEventListener('click', () => this.toggleTerminal());
        }

        if (this.elements.saveBtn) {
            this.elements.saveBtn.addEventListener('click', () => this.saveCurrentFile());
        }

        if (this.elements.formatBtn) {
            this.elements.formatBtn.addEventListener('click', () => this.formatCode());
        }

        if (this.elements.loginBtn) {
            this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
        }

        if (this.elements.recentFilesBtn) {
            this.elements.recentFilesBtn.addEventListener('click', () => this.showRecentFiles());
        }

        document.getElementById('cancelOAuthBtn')?.addEventListener('click', () => {
            this.oauth.cancel();
            this.hideOAuthModal();
        });

        document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
            this.copyUserCode();
        });

        document.addEventListener('keydown', (e) => this.handleGlobalKeyboard(e));
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const body = document.body;

        if (savedTheme === 'dark') {
            body.classList.add('dark-theme');
            if (this.elements.themeIcon) {
                this.elements.themeIcon.textContent = '☀️';
            }
        } else {
            body.classList.remove('dark-theme');
            if (this.elements.themeIcon) {
                this.elements.themeIcon.textContent = '🌙';
            }
        }
    }

    toggleTheme() {
        const body = document.body;
        const isDark = body.classList.toggle('dark-theme');

        if (this.elements.themeIcon) {
            this.elements.themeIcon.textContent = isDark ? '☀️' : '🌙';
        }
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        if (this.editor) {
            monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
        }

        if (this.terminal) {
            this.terminal.setTheme(isDark);
        }

        console.log(`🎨 Switched to ${isDark ? 'dark' : 'light'} theme`);
    }

    async searchRepositories() {
        const query = this.elements.repoSearchInput?.value.trim();
        if (!query) return;

        this.elements.repoResults.innerHTML = `
            <div style="padding: 16px;">Searching for "${query}"...</div>
        `;

        try {
            const githubAPI = new TauriGitHubAPI();
            const results = await githubAPI.searchRepositories(query);

            this.displaySearchResults(results.items || []);

        } catch (error) {
            console.error('Search failed:', error);
            this.elements.repoResults.innerHTML = `
                <div style="padding: 16px; color: #ff4444;">
                    Search failed: ${error.message}
                </div>
            `;
        }
    }

    displaySearchResults(repositories) {
        if (repositories.length === 0) {
            this.elements.repoResults.innerHTML = '<div class="no-results">No repositories found</div>';
            return;
        }

        const repoCards = repositories.map(repo => `
            <div class="repo-result-card" data-repo="${repo.full_name}">
                <div class="repo-title">${repo.full_name}</div>
                <div class="repo-desc">${repo.description || 'No description'}</div>
                <div class="repo-stats">
                    <span>⭐ ${this.formatStars(repo.stargazers_count)}</span>
                    <span class="repo-lang">${repo.language || 'Unknown'}</span>
                </div>
                <div class="repo-actions">
                    <button class="btn btn-small btn-primary"
                            onclick="window.repoSpaceIDE.downloadRepository('${repo.owner.login}', '${repo.name}', '${repo.default_branch}')">
                        📥 Download
                    </button>
                    <button class="btn btn-small btn-secondary"
                            onclick="window.repoSpaceIDE.viewRepoDetails('${repo.owner.login}', '${repo.name}')">
                        👁️ View
                    </button>
                </div>
            </div>
        `).join('');

        this.elements.repoResults.innerHTML = repoCards;
    }

    formatStars(count) {
        if (count >= 1000) return `${(count/1000).toFixed(1)}k`;
        return count.toString();
    }

    clearTerminal() {
        if (this.terminal) {
            this.terminal.clear();
        }
    }

    toggleTerminal() {
        console.log('🔄 Toggle terminal (resize panels coming soon!)');
    }

    formatCode() {
        if (this.editor) {
            this.editor.getAction('editor.action.formatDocument').run();
            console.log('✨ Code formatted');
        }
    }

    handleGlobalKeyboard(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.saveCurrentFile();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.elements.repoSearchInput?.focus();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === '`') {
            e.preventDefault();
            if (this.terminal) {
                this.terminal.focus();
            }
        }
    }

    showRecentFiles() {
        const modal = document.getElementById('recentFilesModal');
        this.renderRecentProjects();
        this.renderRecentFiles();
        modal.style.display = 'flex';
    }

    closeRecentFiles() {
        const modal = document.getElementById('recentFilesModal');
        modal.style.display = 'none';
    }

    renderRecentProjects() {
        const container = document.getElementById('recentProjectsList');
        const projects = this.recentFiles.getRecentProjects();
        const downloaded = this.repoDownloader.getDownloadedRepos();

        const allProjects = [
            ...downloaded.map(d => ({
                name: d.fullName,
                path: d.extractedPath,
                timestamp: d.downloadedAt,
                isDownloaded: true
            })),
            ...projects
        ];

        if (allProjects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📁 No recent projects</p>
                    <p class="hint">Open a folder or download a repository to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allProjects.map(project => {
            const icon = project.isDownloaded ? '📥' : '📁';
            return `
                <div class="recent-item" onclick="window.repoSpaceIDE.openRecentProject('${project.path}')">
                    <div class="recent-item-info">
                        <div class="recent-item-name">${icon} ${this.escapeHtml(project.name)}</div>
                        <div class="recent-item-path">${this.escapeHtml(project.path)}</div>
                    </div>
                    <div class="recent-item-meta">
                        <span class="recent-item-time">${this.recentFiles.formatTimestamp(project.timestamp)}</span>
                        <button class="recent-item-remove" onclick="event.stopPropagation(); window.repoSpaceIDE.removeRecentProject('${project.path}')" title="Remove">×</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRecentFiles() {
        const container = document.getElementById('recentFilesList');
        const files = this.recentFiles.getRecentFiles();

        if (files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📄 No recent files</p>
                    <p class="hint">Open and edit files to see them here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="recent-item" onclick="window.repoSpaceIDE.openRecentFile('${file.path}')">
                <div class="recent-item-info">
                    <div class="recent-item-name">📄 ${this.escapeHtml(file.name)}</div>
                    <div class="recent-item-path">${this.escapeHtml(file.path)}</div>
                </div>
                <div class="recent-item-meta">
                    <span class="recent-item-time">${this.recentFiles.formatTimestamp(file.timestamp)}</span>
                    <button class="recent-item-remove" onclick="event.stopPropagation(); window.repoSpaceIDE.removeRecentFile('${file.path}')" title="Remove">×</button>
                </div>
            </div>
        `).join('');
    }

    async openProjectFolder() {
        try {
            const folderPath = await this.fileSystem.openDirectory();
            if (folderPath) {
                await this.loadProject(folderPath);
                this.closeRecentFiles();
            }
        } catch (error) {
            console.error('Failed to open project:', error);
            await this.showErrorDialog(`Failed to open project: ${error.message}`);
        }
    }

    async loadProject(projectPath) {
        try {
            console.log('📂 Loading project:', projectPath);

            const projectName = projectPath.split('/').pop();
            this.recentFiles.addRecentProject(projectPath, projectName);

            this.currentProject = {
                path: projectPath,
                name: projectName
            };

            if (this.terminal) {
                await this.terminal.setWorkingDirectory(projectPath);
                this.terminal.writeLine(`📂 Working directory set to: ${projectPath}`, 'success');
            }

            await this.loadFileTree(projectPath);

            console.log('✅ Project loaded successfully');
        } catch (error) {
            console.error('Failed to load project:', error);
            throw error;
        }
    }

    async loadFileTree(directoryPath) {
        try {
            const files = await this.fileSystem.readDir(directoryPath);
            this.displayFileTree(files, directoryPath);
        } catch (error) {
            console.error('Failed to load file tree:', error);
            this.elements.fileTree.innerHTML = `
                <div class="placeholder-content">
                    <p style="color: #ef4444;">❌ Failed to load files</p>
                    <p style="font-size: 12px;">${error.message}</p>
                </div>
            `;
        }
    }

    displayFileTree(files, basePath) {
        if (files.length === 0) {
            this.elements.fileTree.innerHTML = `
                <div class="placeholder-content">
                    <p>📂 Empty folder</p>
                </div>
            `;
            return;
        }

        files.sort((a, b) => {
            if (a.is_dir && !b.is_dir) return -1;
            if (!a.is_dir && b.is_dir) return 1;
            return a.name.localeCompare(b.name);
        });

        const fileItems = files.map(file => {
            const icon = file.is_dir ? '📁' : this.getFileIcon(file.name);
            return `
                <div class="file-item ${file.is_dir ? 'directory' : 'file'}"
                     data-path="${file.path}"
                     data-is-dir="${file.is_dir}"
                     onclick="window.repoSpaceIDE.handleFileClick('${file.path}', ${file.is_dir})">
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${this.escapeHtml(file.name)}</span>
                </div>
            `;
        }).join('');

        this.elements.fileTree.innerHTML = `
            <div class="file-tree-header">
                <span>${this.currentProject ? this.currentProject.name : 'Project'}</span>
            </div>
            <div class="file-list">
                ${fileItems}
            </div>
        `;
    }

    async handleFileClick(filePath, isDir) {
        if (isDir) {
            await this.loadFileTree(filePath);
        } else {
            await this.openFile(filePath);
        }
    }

    async openFile(filePath) {
        try {
            const content = await this.fileSystem.readFile(filePath);
            const fileName = filePath.split('/').pop();

            if (this.editor) {
                this.editor.setValue(content);

                const language = this.detectLanguage(fileName);
                const model = this.editor.getModel();

                if (model) {
                    monaco.editor.setModelLanguage(model, language);
                    console.log(`🎨 Language set to: ${language}`);
                }
            }

            this.activeTab = { path: filePath, name: fileName };
            this.recentFiles.addRecentFile(filePath, fileName);

            console.log('✅ File opened:', fileName);
        } catch (error) {
            console.error('Failed to open file:', error);
            await this.showErrorDialog(`Failed to open file: ${error.message}`);
        }
    }

    async openRecentFile(filePath) {
        await this.openFile(filePath);
        this.closeRecentFiles();
    }

    async openRecentProject(projectPath) {
        await this.loadProject(projectPath);
        this.closeRecentFiles();
    }

    removeRecentFile(filePath) {
        this.recentFiles.removeRecentFile(filePath);
        this.renderRecentFiles();
    }

    removeRecentProject(projectPath) {
        this.recentFiles.removeRecentProject(projectPath);
        this.renderRecentProjects();
    }

    clearRecentFiles() {
        if (confirm('Clear all recent files?')) {
            this.recentFiles.clearRecentFiles();
            this.renderRecentFiles();
        }
    }

    clearRecentProjects() {
        if (confirm('Clear all recent projects?')) {
            this.recentFiles.clearRecentProjects();
            this.renderRecentProjects();
        }
    }

    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            js: '📜', ts: '📘', jsx: '⚛️', tsx: '⚛️',
            html: '🌐', css: '🎨', scss: '🎨', sass: '🎨',
            json: '📋', xml: '📋', yaml: '📋', yml: '📋',
            md: '📝', txt: '📄',
            py: '🐍', rb: '💎', php: '🐘',
            java: '☕', cpp: '⚙️', c: '⚙️', h: '⚙️',
            rs: '🦀', go: '🐹',
            sh: '🔧', bash: '🔧',
            png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
            pdf: '📕', zip: '📦', tar: '📦', gz: '📦'
        };
        return iconMap[ext] || '📄';
    }

    detectLanguage(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const langMap = {
            js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
            html: 'html', css: 'css', scss: 'scss', sass: 'sass',
            json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
            md: 'markdown', txt: 'plaintext',
            py: 'python', rb: 'ruby', php: 'php',
            java: 'java', cpp: 'cpp', c: 'c', h: 'c',
            rs: 'rust', go: 'go',
            sh: 'shell', bash: 'shell'
        };
        return langMap[ext] || 'plaintext';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async saveCurrentFile() {
        if (!this.editor) return;

        const content = this.editor.getValue();

        try {
            if (this.activeTab && this.activeTab.path) {
                await this.fileSystem.writeFile(this.activeTab.path, content);
                this.recentFiles.addRecentFile(this.activeTab.path, this.activeTab.name);
                console.log('✅ File saved successfully');
            } else {
                const path = await this.fileSystem.saveFile();
                if (path) {
                    await this.fileSystem.writeFile(path, content);
                    const fileName = path.split('/').pop();
                    this.activeTab = { path, name: fileName };
                    this.recentFiles.addRecentFile(path, fileName);
                    console.log('✅ File saved successfully');
                }
            }
        } catch (error) {
            console.error('❌ Failed to save file:', error);
            await this.showErrorDialog(`Failed to save file: ${error.message}`);
        }
    }

    async downloadRepository(owner, repo, branch) {
        try {
            console.log(`📥 Downloading ${owner}/${repo}...`);

            this.showDownloadProgress(owner, repo);

            const result = await this.repoDownloader.downloadRepo(
                owner,
                repo,
                branch,
                null,
                (progress) => {
                    this.updateDownloadProgress(progress);
                }
            );

            this.hideDownloadProgress();

            await this.showSuccessDialog(
                `✅ Repository downloaded successfully!\n\n` +
                `Saved to: ${result.extractedPath}`
            );

            const shouldOpen = await this.showConfirmDialog(
                'Do you want to open this repository as a project?'
            );

            if (shouldOpen) {
                const files = await this.fileSystem.readDir(result.extractedPath);
                if (files.length === 1 && files[0].is_dir) {
                    await this.loadProject(files[0].path);
                } else {
                    await this.loadProject(result.extractedPath);
                }
            }

        } catch (error) {
            console.error('❌ Download failed:', error);
            this.hideDownloadProgress();

            if (!error.message?.includes('cancelled')) {
                await this.showErrorDialog(`Download failed: ${error.message || error}`);
            }
        }
    }

    async showDownloadLocation() {
        const downloaded = this.repoDownloader.getDownloadedRepos();

        if (downloaded.length === 0) {
            await this.showSuccessDialog(
                '📥 No downloaded repositories yet.\n\n' +
                'Download repositories from the search results,\n' +
                'and you can choose where to save them!'
            );
            return;
        }

        let message = '📥 Downloaded Repositories:\n\n';
        downloaded.forEach((repo, index) => {
            message += `${index + 1}. ${repo.fullName} (${repo.branch})\n`;
            message += `   📂 ${repo.savePath}\n\n`;
        });

        await this.showSuccessDialog(message);
    }

    async viewRepoDetails(owner, repo) {
        try {
            const token = this.githubToken || null;
            const info = await this.repoDownloader.getRepoInfo(owner, repo, token);

            this.showRepoDetailsModal(info);

        } catch (error) {
            console.error('Failed to get repo details:', error);
            await this.showErrorDialog(`Failed to load repository details: ${error.message}`);
        }
    }

    showDownloadProgress(owner, repo) {
        const modal = document.getElementById('downloadProgressModal');
        if (!modal) {
            const modalHTML = `
                <div class="modal" id="downloadProgressModal" style="display: flex;">
                    <div class="modal-content">
                        <h2>📥 Downloading Repository</h2>
                        <p id="downloadRepoName">${owner}/${repo}</p>
                        <div class="progress-bar">
                            <div class="progress-fill" id="downloadProgressFill"></div>
                        </div>
                        <p id="downloadProgressText">Preparing download...</p>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        } else {
            modal.style.display = 'flex';
            document.getElementById('downloadRepoName').textContent = `${owner}/${repo}`;
            document.getElementById('downloadProgressFill').style.width = '0%';
            document.getElementById('downloadProgressText').textContent = 'Preparing download...';
        }
    }

    updateDownloadProgress(progress) {
        const fill = document.getElementById('downloadProgressFill');
        const text = document.getElementById('downloadProgressText');

        if (fill) {
            fill.style.width = `${progress.progress}%`;
        }

        if (text) {
            const messages = {
                preparing: 'Preparing download...',
                downloading: 'Downloading ZIP file...',
                extracting: 'Extracting files...',
                completing: 'Finishing up...',
                done: 'Complete!'
            };
            text.textContent = messages[progress.stage] || 'Processing...';
        }
    }

    hideDownloadProgress() {
        const modal = document.getElementById('downloadProgressModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showRepoDetailsModal(info) {
        alert(`Repository: ${info.full_name}\n\nStars: ${info.stargazers_count}\nForks: ${info.forks_count}\nLanguage: ${info.language || 'N/A'}\n\nDescription: ${info.description || 'No description'}`);
    }

    async showSuccessDialog(message) {
        try {
            await window.__TAURI__.dialog.message(message, {
                title: 'Success',
                kind: 'info'
            });
        } catch (e) {
            console.log(message);
        }
    }

    async showErrorDialog(message) {
        try {
            await window.__TAURI__.dialog.message(message, {
                title: 'Error',
                kind: 'error'
            });
        } catch (e) {
            console.error(message);
        }
    }

    async showConfirmDialog(message) {
        try {
            return await window.__TAURI__.dialog.confirm(message, {
                title: 'Confirm',
                kind: 'warning'
            });
        } catch (e) {
            console.log(message);
            return false;
        }
    }

    async handleLogin() {
        if (this.githubToken) {
            const shouldLogout = await this.showConfirmDialog(
                'You are already logged in. Do you want to log out?'
            );
            if (shouldLogout) {
                this.handleLogout();
            }
            return;
        }

        try {
            this.elements.loginBtn.disabled = true;
            this.elements.loginBtn.textContent = 'Authenticating...';

            this.oauth.onUserCode((codeData) => {
                if (codeData) {
                    this.showOAuthModal(codeData);
                } else {
                    this.hideOAuthModal();
                }
            });

            const token = await this.oauth.startDeviceFlow();

            localStorage.setItem('github_token', token);
            this.githubToken = token;

            const user = await this.oauth.getUserInfo(token);

            this.updateUserInfo(user);

            console.log('✅ Successfully logged in as:', user.login);

        } catch (error) {
            console.error('❌ Login failed:', error);
            await this.showErrorDialog(`Login failed: ${error.message}`);
        } finally {
            this.elements.loginBtn.disabled = false;
            this.elements.loginBtn.textContent = 'Sign in with GitHub';
            this.hideOAuthModal();
        }
    }

    handleLogout() {
        localStorage.removeItem('github_token');
        this.githubToken = null;

        this.elements.loginBtn.style.display = 'block';
        this.elements.userInfo.style.display = 'none';
        this.elements.userInfo.textContent = '';

        console.log('✅ Logged out successfully');
    }

    updateUserInfo(user) {
        this.elements.loginBtn.style.display = 'none';
        this.elements.userInfo.style.display = 'flex';
        this.elements.userInfo.innerHTML = `

            <img src="${user.avatar_url}"
                 alt="${user.login}"
                 style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px;">
            <span>${user.login}</span>
        `;

        this.elements.userInfo.style.cursor = 'pointer';
        this.elements.userInfo.onclick = () => this.handleLogout();
    }

    showOAuthModal(codeData) {
        const modal = document.getElementById('oauthModal');
        const codeDisplay = document.getElementById('userCodeDisplay').querySelector('.user-code');

        codeDisplay.textContent = codeData.code;
        modal.style.display = 'flex';

        this.currentUserCode = codeData.originalCode;
    }

    hideOAuthModal() {
        const modal = document.getElementById('oauthModal');
        modal.style.display = 'none';
        this.currentUserCode = null;
    }

    copyUserCode() {
        if (this.currentUserCode) {
            navigator.clipboard.writeText(this.currentUserCode).then(() => {
                const btn = document.getElementById('copyCodeBtn');
                const originalText = btn.textContent;
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            });
        }
    }
}

// Initialize IDE when script loads
const ide = new RepoSpaceIDE();

// Export for debugging
window.repoSpaceIDE = ide;
