export class DitheringManager {
    constructor(app) {
        this.app = app;

        // Dithering Configuration
        this.cellSize = 7;
        this.color = '#002a00';
        this.maxRadiusRatio = 0.8;

        this.charSet = {
            light: [' ', '.', '·', ':', '¸', ';', '!', '|'],
            medium: ['i', 'l', 'I', '/', '\\', 't', 'r', 'f', '1', 'c', 'v', 'x', 'n', 'u', 'z', 'o', 's', 'a', 'e'],
            dense: ['L', 'C', 'J', 'U', 'Y', 'X', 'Z', 'O', '0', 'Q', 'G', 'D', 'H', 'K', 'A', 'N', 'M', 'W', '#']
        };

        this.previousThreshold = 15;
        this.previousBlur = 0;
    }

    getMaxRadiusRatio() {
        if (this.app.asciiOverlayEnabled) {
            const thresholdValue = this.app.postProcessing.threshold;
            return 0.2 + (thresholdValue / 40) * 1.3;
        }
        return this.maxRadiusRatio;
    }

    getMorphLevel() {
        if (this.app.asciiOverlayEnabled) {
            return this.app.postProcessing.blur;
        }
        return 0;
    }

    getCharForBrightness(brightness, x, y, time) {
        const timeSeed = Math.floor(time / 50);
        const seed = (x * 73 + y * 37 + timeSeed * 17) % 100;
        const contrastBrightness = Math.pow(brightness, 2);

        if (contrastBrightness > 0.15) {
            const chars = this.charSet.light;
            const index = seed % chars.length;
            return { char: chars[index], type: 'light' };
        } else if (contrastBrightness > 0.05) {
            const chars = this.charSet.medium;
            const index = seed % chars.length;
            return { char: chars[index], type: 'medium' };
        } else {
            const chars = this.charSet.dense;
            const index = seed % chars.length;
            return { char: chars[index], type: 'dense' };
        }
    }

    toggleOverlay() {
        this.app.asciiOverlayEnabled = !this.app.asciiOverlayEnabled;
        const overlay = document.getElementById('ascii-overlay');
        const mainCanvas = document.getElementById('canvas-main');

        if (overlay) {
            if (this.app.asciiOverlayEnabled) {
                overlay.style.display = 'block';
            } else {
                overlay.parentElement?.removeChild(overlay);
            }
        }

        if (mainCanvas) {
            mainCanvas.style.opacity = this.app.asciiOverlayEnabled ? '0' : '1';
        }

        const thresholdLabel = document.querySelector('label[for="threshold"]');
        const thresholdValue = document.getElementById('value-threshold');
        const blurLabel = document.querySelector('label[for="blur"]');

        if (this.app.asciiOverlayEnabled) {
            this.previousThreshold = this.app.postProcessing.threshold;
            this.previousBlur = this.app.postProcessing.blur;
            this.app.updatePostProcessing('blur', 0);

            if (thresholdLabel) thresholdLabel.textContent = 'SCALE';
            if (thresholdValue) thresholdValue.textContent = this.previousThreshold;
            if (blurLabel) blurLabel.textContent = 'MORPH';

            // Force slider update to reflect new swapped values
            const blurSlider = document.getElementById('blur');
            const thresholdSlider = document.getElementById('threshold');
            if (blurSlider) blurSlider.value = 0;
            if (thresholdSlider) thresholdSlider.value = this.previousThreshold;

        } else {
            this.app.updatePostProcessing('threshold', this.previousThreshold);
            this.app.updatePostProcessing('blur', this.previousBlur);

            if (thresholdLabel) thresholdLabel.textContent = 'THRESHOLD';
            if (thresholdValue) thresholdValue.textContent = this.previousThreshold;
            if (blurLabel) blurLabel.textContent = 'BLUR';

            // Force slider update to reflect restored values
            const blurSlider = document.getElementById('blur');
            const thresholdSlider = document.getElementById('threshold');
            if (blurSlider) blurSlider.value = this.previousBlur;
            if (thresholdSlider) thresholdSlider.value = this.previousThreshold;

            this.app.postProcessor.applyPostProcessing();
        }
    }

    update() {
        if (!this.app.asciiOverlayEnabled) return;
        this.showAsciiSphereOverlay();
    }

    showAsciiSphereOverlay() {
        const canvas = document.getElementById('canvas-main');
        let overlay = document.getElementById('ascii-overlay');

        if (!canvas) return;

        if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.id = 'ascii-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '50%';
            overlay.style.left = '50%';
            overlay.style.transform = 'translate(-50%, -50%)';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '10';
            if (canvas.parentElement) {
                canvas.parentElement.style.position = 'relative';
                canvas.parentElement.appendChild(overlay);
            }
        }

        if (overlay.width !== canvas.width || overlay.height !== canvas.height) {
            overlay.width = canvas.width;
            overlay.height = canvas.height;
        }

        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // Access grayscaleImageData from App (populated by PostProcessor)
        if (!this.app.grayscaleImageData) return;

        this.drawOnCanvas(ctx, overlay.width, overlay.height, 1, this.app.grayscaleImageData, this.app.panelThemeInverted);
    }

    drawOnCanvas(ctx, width, height, scale, imageData, invertTheme) {
        const data = imageData.data;

        const cellSize = this.cellSize * scale;
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        const time = Date.now();
        const morphLevel = this.getMorphLevel();
        const morphRatio = morphLevel / 30;

        // Determine color
        if (invertTheme) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = x * cellSize;
                const py = y * cellSize;
                const i = (py * width + px) * 4;
                if (i >= data.length) continue;

                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

                if (avg < 250) {
                    const brightness = avg / 255;
                    const cellHash = (x * 73 + y * 37) % 100;
                    const useCharacter = cellHash < (morphRatio * 100);

                    if (useCharacter) {
                        const charData = this.getCharForBrightness(brightness, x, y, time);
                        if (charData.type === 'dense') {
                            ctx.font = `bold ${cellSize * 1.1}px 'Roboto Mono'`;
                        } else {
                            ctx.font = `${cellSize * 1.1}px 'Roboto Mono'`;
                        }
                        ctx.fillText(charData.char, px + cellSize / 2, py + cellSize / 2);
                    } else {
                        const maxRatio = this.getMaxRadiusRatio();
                        const sizes = [
                            cellSize * 0.12 * maxRatio,
                            cellSize * 0.25 * maxRatio,
                            cellSize * 0.40 * maxRatio,
                            cellSize * 0.60 * maxRatio,
                            cellSize * 0.90 * maxRatio
                        ];

                        let idx = Math.floor((1 - brightness) * sizes.length);
                        if (idx < 0) idx = 0;
                        if (idx >= sizes.length) idx = sizes.length - 1;

                        const radius = sizes[idx];
                        if (radius > 0.05 * scale) {
                            ctx.beginPath();
                            ctx.arc(px + cellSize / 2, py + cellSize / 2, radius, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
            }
        }
    }
}
