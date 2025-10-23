// custom-terminal.js - Enhanced RepoSpace Terminal with Real Command Execution
class RepoSpaceTerminal {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.lines = [];
        this.currentInput = '';
        this.cursorPosition = 0;
        this.history = [];
        this.historyIndex = -1;
        this.isProcessing = false;
        this.prompt = '$ ';
        this.workingDir = null;
        
        this.invoke = window.__TAURI__?.core?.invoke;
        this.listen = window.__TAURI__?.event?.listen;
        
        this.init();
    }

    async init() {
        this.container.innerHTML = '';
        this.container.className = 'custom-terminal';

        this.display = document.createElement('div');
        this.display.className = 'terminal-display';
        this.display.setAttribute('tabindex', '0');
        this.container.appendChild(this.display);

        this.inputLine = document.createElement('div');
        this.inputLine.className = 'terminal-input-line';
        this.display.appendChild(this.inputLine);

        this.updateInputLine();
        this.setupEventListeners();
        this.focus();

        await this.updateWorkingDir();

        this.writeLine('RepoSpace IDE Terminal v2.0 - Real Command Execution', 'success');
        this.writeLine('Type "help" for available commands');
        this.writeLine('');
    }

    async updateWorkingDir() {
        if (this.invoke) {
            try {
                this.workingDir = await this.invoke('get_current_dir');
            } catch (error) {
                console.error('Failed to get working directory:', error);
                this.workingDir = '~';
            }
        }
    }

    setupEventListeners() {
        this.display.addEventListener('click', () => this.focus());
        this.display.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.display.addEventListener('keypress', (e) => this.handleKeyPress(e));
        
        this.display.addEventListener('selectstart', (e) => {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
            }
        });

        if (this.listen) {
            this.listen('terminal_output', (event) => {
                const { type, line } = event.payload;
                const className = type === 'stderr' ? 'error' : '';
                this.writeLine(line, className);
            });
        }
    }

    focus() {
        this.display.focus();
        this.display.classList.add('focused');
    }

    blur() {
        this.display.classList.remove('focused');
    }

    handleKeyDown(e) {
        if (this.isProcessing) {
            // Allow Ctrl+C during execution
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                this.interrupt();
            }
            return;
        }

        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.executeCommand();
                break;

            case 'Backspace':
                e.preventDefault();
                this.handleBackspace();
                break;

            case 'Delete':
                e.preventDefault();
                this.handleDelete();
                break;

            case 'ArrowLeft':
                e.preventDefault();
                this.moveCursor(-1);
                break;

            case 'ArrowRight':
                e.preventDefault();
                this.moveCursor(1);
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory(-1);
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory(1);
                break;

            case 'Home':
                e.preventDefault();
                this.cursorPosition = 0;
                this.updateInputLine();
                break;

            case 'End':
                e.preventDefault();
                this.cursorPosition = this.currentInput.length;
                this.updateInputLine();
                break;

            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.cursorPosition = 0;
                    this.updateInputLine();
                }
                break;

            case 'e':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.cursorPosition = this.currentInput.length;
                    this.updateInputLine();
                }
                break;

            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.interrupt();
                }
                break;

            case 'l':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.clear();
                }
                break;
        }
    }

    handleKeyPress(e) {
        if (this.isProcessing) return;

        const char = e.key;
        if (char.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.insertChar(char);
        }
    }

    insertChar(char) {
        const before = this.currentInput.slice(0, this.cursorPosition);
        const after = this.currentInput.slice(this.cursorPosition);
        this.currentInput = before + char + after;
        this.cursorPosition++;
        this.updateInputLine();
    }

    handleBackspace() {
        if (this.cursorPosition > 0) {
            const before = this.currentInput.slice(0, this.cursorPosition - 1);
            const after = this.currentInput.slice(this.cursorPosition);
            this.currentInput = before + after;
            this.cursorPosition--;
            this.updateInputLine();
        }
    }

    handleDelete() {
        if (this.cursorPosition < this.currentInput.length) {
            const before = this.currentInput.slice(0, this.cursorPosition);
            const after = this.currentInput.slice(this.cursorPosition + 1);
            this.currentInput = before + after;
            this.updateInputLine();
        }
    }

    moveCursor(direction) {
        const newPos = this.cursorPosition + direction;
        if (newPos >= 0 && newPos <= this.currentInput.length) {
            this.cursorPosition = newPos;
            this.updateInputLine();
        }
    }

    navigateHistory(direction) {
        if (this.history.length === 0) return;

        const newIndex = this.historyIndex + direction;

        if (newIndex >= 0 && newIndex < this.history.length) {
            this.historyIndex = newIndex;
            this.currentInput = this.history[newIndex];
            this.cursorPosition = this.currentInput.length;
        } else if (newIndex < 0) {
            this.historyIndex = -1;
            this.currentInput = '';
            this.cursorPosition = 0;
        }

        this.updateInputLine();
    }

    updateInputLine() {
        const before = this.currentInput.slice(0, this.cursorPosition);
        const cursorChar = this.currentInput[this.cursorPosition] || ' ';
        const after = this.currentInput.slice(this.cursorPosition + 1);

        this.inputLine.innerHTML = `
            <span class="terminal-prompt">${this.prompt}</span>
            <span class="terminal-input-text">${this.escapeHtml(before)}</span>
            <span class="terminal-cursor ${this.display.classList.contains('focused') ? 'blink' : ''}">${this.escapeHtml(cursorChar)}</span>
            <span class="terminal-input-text">${this.escapeHtml(after)}</span>
        `;

        this.scrollToBottom();
    }

    executeCommand() {
        const command = this.currentInput.trim();

        if (command && (this.history.length === 0 || this.history[this.history.length - 1] !== command)) {
            this.history.push(command);
        }
        this.historyIndex = -1;

        this.writeLine(`${this.prompt}${command}`, 'input');

        this.currentInput = '';
        this.cursorPosition = 0;

        this.processCommand(command);
    }

    async processCommand(command) {
        this.isProcessing = true;

        if (!command) {
            this.finishCommand();
            return;
        }

        const args = command.split(' ').filter(arg => arg.length > 0);
        const cmd = args[0].toLowerCase();

        // Built-in commands
        switch (cmd) {
            case 'help':
                this.showHelp();
                this.finishCommand();
                return;

            case 'clear':
            case 'cls':
                this.clear();
                this.finishCommand();
                return;

            case 'history':
                this.showHistory();
                this.finishCommand();
                return;

            case 'cd':
                await this.changeDirectory(args[1] || '~');
                this.finishCommand();
                return;

            case 'pwd':
                this.writeLine(this.workingDir || '~');
                this.finishCommand();
                return;
        }

        // Execute real system command
        if (this.invoke) {
            try {
                this.writeLine('Executing...', 'warning');
                
                const result = await this.invoke('execute_command', {
                    command: command,
                    workingDir: this.workingDir
                });

                if (result.stdout && result.stdout.trim()) {
                    // Output already written via real-time events
                    // this.writeLine(result.stdout);
                }

                if (result.stderr && result.stderr.trim()) {
                    // this.writeLine(result.stderr, 'error');
                }

                if (!result.success) {
                    this.writeLine(`Command exited with code: ${result.exit_code}`, 'error');
                }
            } catch (error) {
                this.writeLine(`Error: ${error}`, 'error');
            }
        } else {
            this.writeLine(`Command not found: ${cmd}`, 'error');
            this.writeLine('Tauri API not available - running in mock mode');
        }

        this.finishCommand();
    }

    async changeDirectory(path) {
        if (!path) {
            this.writeLine('Usage: cd <directory>', 'error');
            return;
        }

        if (this.invoke) {
            try {
                const newDir = await this.invoke('change_directory', { path });
                this.workingDir = newDir;
                this.writeLine(`Changed directory to: ${newDir}`, 'success');
            } catch (error) {
                this.writeLine(`cd: ${error}`, 'error');
            }
        } else {
            this.writeLine('cd: Tauri API not available', 'error');
        }
    }

    showHelp() {
        const commands = [
            ['Built-in Commands:', ''],
            ['help', 'Show this help message'],
            ['clear, cls', 'Clear the terminal'],
            ['pwd', 'Show current directory'],
            ['cd <dir>', 'Change directory'],
            ['history', 'Show command history'],
            ['', ''],
            ['System Commands:', ''],
            ['ls, dir', 'List files'],
            ['cat <file>', 'Display file contents'],
            ['echo <text>', 'Display text'],
            ['node <file>', 'Run Node.js script'],
            ['python <file>', 'Run Python script'],
            ['git <args>', 'Git commands'],
            ['npm <args>', 'NPM commands'],
            ['cargo <args>', 'Cargo commands'],
            ['...', 'Any system command available']
        ];

        commands.forEach(([cmd, desc]) => {
            if (cmd && desc) {
                this.writeLine(`  ${cmd.padEnd(20)} ${desc}`);
            } else if (cmd) {
                this.writeLine(`\n${cmd}`);
            } else {
                this.writeLine('');
            }
        });
    }

    showHistory() {
        if (this.history.length === 0) {
            this.writeLine('No command history');
            return;
        }

        this.history.forEach((cmd, index) => {
            this.writeLine(`${(index + 1).toString().padStart(4)}: ${cmd}`);
        });
    }

    finishCommand() {
        this.isProcessing = false;
        this.updateInputLine();
    }

    writeLine(text, className = '') {
        const line = document.createElement('div');
        line.className = `terminal-line ${className}`;
        line.textContent = text;

        this.display.insertBefore(line, this.inputLine);
        this.scrollToBottom();
    }

    interrupt() {
        if (this.isProcessing) {
            this.writeLine('^C', 'error');
            this.writeLine('Process interrupted', 'warning');
            this.isProcessing = false;
        }
        this.currentInput = '';
        this.cursorPosition = 0;
        this.updateInputLine();
    }

    clear() {
        const lines = this.display.querySelectorAll('.terminal-line');
        lines.forEach(line => line.remove());
        this.scrollToBottom();
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.display.scrollTop = this.display.scrollHeight;
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setTheme(isDark) {
        this.container.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }

    // Public API
    async setWorkingDirectory(path) {
        await this.changeDirectory(path);
    }

    getWorkingDirectory() {
        return this.workingDir;
    }
}

window.RepoSpaceTerminal = RepoSpaceTerminal;
