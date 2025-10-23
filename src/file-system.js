// file-system.js - Tauri File System API Wrapper

class TauriFileSystem {
    constructor() {
        this.tauri = window.__TAURI__;
    }

    async readFile(path) {
        try {
            const content = await this.tauri.core.invoke('read_file', { path });
            return content;
        } catch (error) {
            console.error('Failed to read file:', error);
            throw error;
        }
    }

    async writeFile(path, contents) {
        try {
            await this.tauri.core.invoke('write_file', { path, contents });
            console.log(`✅ File saved: ${path}`);
        } catch (error) {
            console.error('Failed to write file:', error);
            throw error;
        }
    }

    async readDir(path) {
        try {
            const entries = await this.tauri.core.invoke('read_dir', { path });
            return entries;
        } catch (error) {
            console.error('Failed to read directory:', error);
            throw error;
        }
    }

    async createDir(path) {
        try {
            await this.tauri.core.invoke('create_dir', { path });
            console.log(`✅ Directory created: ${path}`);
        } catch (error) {
            console.error('Failed to create directory:', error);
            throw error;
        }
    }

    async deleteFile(path) {
        try {
            await this.tauri.core.invoke('delete_file', { path });
            console.log(`✅ File deleted: ${path}`);
        } catch (error) {
            console.error('Failed to delete file:', error);
            throw error;
        }
    }

    async deleteDir(path) {
        try {
            await this.tauri.core.invoke('delete_dir', { path });
            console.log(`✅ Directory deleted: ${path}`);
        } catch (error) {
            console.error('Failed to delete directory:', error);
            throw error;
        }
    }

    async fileExists(path) {
        try {
            return await this.tauri.core.invoke('file_exists', { path });
        } catch (error) {
            console.error('Failed to check file existence:', error);
            return false;
        }
    }

    async openFile() {
        try {
            const selected = await this.tauri.dialog.open({
                multiple: false,
                directory: false
            });
            return selected;
        } catch (error) {
            console.error('Failed to open file dialog:', error);
            return null;
        }
    }

    async openDirectory() {
        try {
            const selected = await this.tauri.dialog.open({
                multiple: false,
                directory: true
            });
            return selected;
        } catch (error) {
            console.error('Failed to open directory dialog:', error);
            return null;
        }
    }

    async saveFile(defaultPath = null) {
        try {
            const selected = await this.tauri.dialog.save({
                defaultPath: defaultPath
            });
            return selected;
        } catch (error) {
            console.error('Failed to open save dialog:', error);
            return null;
        }
    }
}

// Export for use in other modules
window.TauriFileSystem = TauriFileSystem;
