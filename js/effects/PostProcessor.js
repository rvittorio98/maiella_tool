import * as THREE from 'three';

export class PostProcessor {
    constructor(app) {
        this.app = app;
    }

    applyPostProcessing() {
        if (!this.app.tempCtx || !this.app.tempCanvasMain || !this.app.displayCanvas) return;

        const width = this.app.displayCanvas.width;
        const height = this.app.displayCanvas.height;

        this.app.tempCtx.clearRect(0, 0, width, height);
        this.app.tempCtx.drawImage(this.app.tempCanvasMain, 0, 0, width, height);

        let imageData = this.app.tempCtx.getImageData(0, 0, width, height);
        let data = imageData.data;

        // Increase contrast range for stronger effect
        const contrast = this.app.postProcessing.contrast * 2.5;
        const factor = (contrast > 0) ? (259 * (contrast + 255)) / ((255 - contrast) * 255) : 1;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = factor * (data[i] - 128) + 128;
            data[i + 1] = factor * (data[i + 1] - 128) + 128;
            data[i + 2] = factor * (data[i + 2] - 128) + 128;
        }
        this.app.tempCtx.putImageData(imageData, 0, 0);

        if (this.app.postProcessing.blur > 0 && !this.app.asciiOverlayEnabled) {
            const blurAmount = this.app.postProcessing.blur;
            this.app.tempCtx.filter = `blur(${blurAmount}px)`;
            this.app.tempCtx.drawImage(this.app.displayCanvas, 0, 0, width, height);
            this.app.tempCtx.filter = 'none';
        }

        // CRITICAL: Save grayscale data BEFORE threshold for dithering
        this.app.grayscaleImageData = this.app.tempCtx.getImageData(0, 0, width, height);

        const finalData = this.app.tempCtx.getImageData(0, 0, width, height);
        const finalPixels = finalData.data;
        const threshold = (this.app.postProcessing.threshold / 40) * 255;
        const invertTheme = this.app.panelThemeInverted;

        for (let i = 0; i < finalPixels.length; i += 4) {
            const avg = (finalPixels[i] + finalPixels[i + 1] + finalPixels[i + 2]) / 3;
            if (avg > threshold) {
                if (invertTheme) {
                    // Was white, now green
                    finalPixels[i] = 0;
                    finalPixels[i + 1] = 42;
                    finalPixels[i + 2] = 0;
                } else {
                    // White
                    finalPixels[i] = 255;
                    finalPixels[i + 1] = 255;
                    finalPixels[i + 2] = 255;
                }
            } else {
                if (invertTheme) {
                    // Was green, now white
                    finalPixels[i] = 255;
                    finalPixels[i + 1] = 255;
                    finalPixels[i + 2] = 255;
                } else {
                    // Green
                    finalPixels[i] = 0;
                    finalPixels[i + 1] = 42;
                    finalPixels[i + 2] = 0;
                }
            }
        }

        this.app.tempCtx.putImageData(finalData, 0, 0);
    }

    renderHighRes(scale = 4) {
        const exportCanvas = document.createElement('canvas');
        const baseWidth = this.app.displayCanvas.width;
        const baseHeight = this.app.displayCanvas.height;
        exportCanvas.width = baseWidth * scale;
        exportCanvas.height = baseHeight * scale;

        const exportRenderer = new THREE.WebGLRenderer({
            canvas: exportCanvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        exportRenderer.setSize(exportCanvas.width, exportCanvas.height);
        exportRenderer.render(this.app.sceneMain, this.app.cameraMain);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportCanvas.width;
        tempCanvas.height = exportCanvas.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        tempCtx.drawImage(exportCanvas, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        // Correct Contrast Formula matches applyPostProcessing
        const contrast = this.app.postProcessing.contrast * 2.5;
        const factor = (contrast > 0) ? (259 * (contrast + 255)) / ((255 - contrast) * 255) : 1;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = factor * (data[i] - 128) + 128;
            data[i + 1] = factor * (data[i + 1] - 128) + 128;
            data[i + 2] = factor * (data[i + 2] - 128) + 128;
        }
        tempCtx.putImageData(imageData, 0, 0);

        // Apply Blur if needed
        if (this.app.postProcessing.blur > 0 && !this.app.asciiOverlayEnabled) {
            const blurAmount = this.app.postProcessing.blur * scale;
            tempCtx.filter = `blur(${blurAmount}px)`;
            tempCtx.drawImage(tempCanvas, 0, 0);
            tempCtx.filter = 'none';
        }

        const invertTheme = this.app.panelThemeInverted;

        // === DITHERING MODE ===
        if (this.app.asciiOverlayEnabled) {
            // Re-read data after contrast/blur (this corresponds to grayscale logic)
            const grayscaleData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

            // Clear canvas to transparent
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

            // Use DitheringManager to draw
            if (this.app.ditheringManager) {
                this.app.ditheringManager.drawOnCanvas(tempCtx, tempCanvas.width, tempCanvas.height, scale, grayscaleData, invertTheme);
            }
        }
        // === THRESHOLD MODE ===
        else {
            const finalData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const finalPixels = finalData.data;
            const threshold = (this.app.postProcessing.threshold / 40) * 255;

            for (let i = 0; i < finalPixels.length; i += 4) {
                const avg = (finalPixels[i] + finalPixels[i + 1] + finalPixels[i + 2]) / 3;

                if (avg > threshold) {
                    // Background -> Transparent
                    finalPixels[i] = 0;
                    finalPixels[i + 1] = 0;
                    finalPixels[i + 2] = 0;
                    finalPixels[i + 3] = 0;
                } else {
                    // Content
                    if (invertTheme) {
                        // Dark Mode Content -> White
                        finalPixels[i] = 255;
                        finalPixels[i + 1] = 255;
                        finalPixels[i + 2] = 255;
                    } else {
                        // Light Mode Content -> Dark Green
                        finalPixels[i] = 0;
                        finalPixels[i + 1] = 42;
                        finalPixels[i + 2] = 0;
                    }
                    finalPixels[i + 3] = 255;
                }
            }
            tempCtx.putImageData(finalData, 0, 0);
        }

        exportRenderer.dispose();
        return tempCanvas;
    }

    exportPNG() {
        if (!this.app.displayCanvas) return;

        const highResCanvas = this.renderHighRes(4);

        const link = document.createElement('a');
        link.download = `maiella-sphere-${Date.now()}.png`;
        link.href = highResCanvas.toDataURL('image/png');
        link.click();
    }
}
