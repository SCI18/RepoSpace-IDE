// recent-files-manager.js - Manage recent files and projects
class RecentFilesManager {
    constructor() {
        this.maxRecentFiles = 10;
        this.maxRecentProjects = 5;
        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            this.recentFiles = JSON.parse(localStorage.getItem('recent_files') || '[]');
            this.recentProjects = JSON.parse(localStorage.getItem('recent_projects') || '[]');
        } catch (error) {
            console.error('Failed to load recent files:', error);
            this.recentFiles = [];
            this.recentProjects = [];
        }
    }

    saveToStorage() {
        localStorage.setItem('recent_files', JSON.stringify(this.recentFiles));
        localStorage.setItem('recent_projects', JSON.stringify(this.recentProjects));
    }

    addRecentFile(filePath, fileName) {
        const fileEntry = {
            path: filePath,
            name: fileName || filePath.split('/').pop(),
            timestamp: Date.now(),
            lastModified: new Date().toISOString()
        };

        this.recentFiles = this.recentFiles.filter(f => f.path !== filePath);

        this.recentFiles.unshift(fileEntry);

        if (this.recentFiles.length > this.maxRecentFiles) {
            this.recentFiles = this.recentFiles.slice(0, this.maxRecentFiles);
        }

        this.saveToStorage();
    }

    addRecentProject(projectPath, projectName) {
        const projectEntry = {
            path: projectPath,
            name: projectName || projectPath.split('/').pop(),
            timestamp: Date.now(),
            lastOpened: new Date().toISOString()
        };

        this.recentProjects = this.recentProjects.filter(p => p.path !== projectPath);

        this.recentProjects.unshift(projectEntry);

        if (this.recentProjects.length > this.maxRecentProjects) {
            this.recentProjects = this.recentProjects.slice(0, this.maxRecentProjects);
        }

        this.saveToStorage();
    }

    getRecentFiles() {
        return this.recentFiles;
    }

    getRecentProjects() {
        return this.recentProjects;
    }

    removeRecentFile(filePath) {
        this.recentFiles = this.recentFiles.filter(f => f.path !== filePath);
        this.saveToStorage();
    }

    removeRecentProject(projectPath) {
        this.recentProjects = this.recentProjects.filter(p => p.path !== projectPath);
        this.saveToStorage();
    }

    clearRecentFiles() {
        this.recentFiles = [];
        this.saveToStorage();
    }

    clearRecentProjects() {
        this.recentProjects = [];
        this.saveToStorage();
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
//Export for use 
window.RecentFilesManager = RecentFilesManager;
