export class CodeFlow {
    constructor(selector) {
        this.container = document.querySelector(selector);
        this.maxLines = 50;
        this.queue = [];
        this.isProcessing = false;

        if (this.container) {
            // Ensure container styles for scrolling
            this.container.style.overflow = 'hidden';
            this.container.style.display = 'flex';
            this.container.style.flexDirection = 'column';
            this.container.style.justifyContent = 'flex-end';
        }
    }

    log(action, value) {
        if (!this.container) return;

        // Cap queue size to prevent massive lag
        if (this.queue.length > 20) {
            this.queue.shift(); // Drop oldest pending message
        }

        this.queue.push({ action, value });

        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;

        // Consume one item
        const { action, value } = this.queue.shift();
        this.appendLine(action, value);

        // Wait before processing next item (throttle speed)
        // 30ms = fast enough to feel responsive, slow enough to be readable/stable
        await new Promise(resolve => setTimeout(resolve, 30));

        this.processQueue();
    }

    appendLine(action, value) {
        const timestamp = new Date().toLocaleTimeString('it-IT', { hour12: false }) + '.' + Math.floor(Math.random() * 999).toString().padStart(3, '0');
        const hex = this.generateRandomHex();

        // Format value cleanly
        let valStr = value;
        if (typeof value === 'number') {
            valStr = value.toFixed(2);
        }

        const lineText = `[${timestamp}] :: ${hex} >> ${action.toUpperCase()} : ${valStr}`;

        // Remove typewriter effect from previous line to snap it to full visibility
        if (this.container.lastElementChild) {
            this.container.lastElementChild.classList.remove('typewriter');
        }

        const line = document.createElement('div');
        line.classList.add('code-line', 'typewriter');
        line.textContent = lineText;

        this.container.appendChild(line);

        // Prune old lines
        while (this.container.children.length > this.maxLines) {
            this.container.removeChild(this.container.firstChild);
        }

        // Force scroll to bottom to ensure new line is seen
        this.container.scrollTop = this.container.scrollHeight;
    }

    generateRandomHex() {
        return '0x' + Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
    }
}
