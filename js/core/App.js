import { SceneManager } from './SceneManager.js';
import { SphereGenerator } from '../components/SphereGenerator.js';
import { DitheringManager } from '../effects/Dithering.js';
import { PostProcessor } from '../effects/PostProcessor.js';
import { UIManager } from '../ui/UIManager.js';
import { CodeFlow } from '../effects/CodeFlow.js';

class App {
    constructor() {
        // State
        this.rotation = { x: 0, y: -75 * (Math.PI / 180) };
        this.lateralScale = 1;
        this.peakCount = 1;

        this.displacement = {
            scale: 50,
            roughness: 50,
            detail: 50
        };

        this.postProcessing = {
            contrast: 10,
            blur: 0,
            threshold: 15
        };

        this.asciiOverlayEnabled = false;
        this.panelThemeInverted = false;
        this.grayscaleImageData = null;

        // Components
        this.sceneManager = new SceneManager(this);
        this.sphereGenerator = new SphereGenerator(this);
        this.ditheringManager = new DitheringManager(this);
        this.postProcessor = new PostProcessor(this);
        this.uiManager = new UIManager(this);
        this.codeFlow = new CodeFlow('.code-text');
    }

    init() {
        this.sceneManager.setupPreview();
        this.sceneManager.setupMain();

        this.sphereGenerator.createSphere(true);
        this.sphereGenerator.createSphere(false);

        // Bind resize event
        window.addEventListener('resize', () => this.sceneManager.onResize());

        // Initialize UI
        this.uiManager.init();
        this.createCustomButtons(); // Create dynamic buttons (Dithering, Theme)

        this.animate();
    }

    createCustomButtons() {
        const container = document.querySelector('.panel-right-top');
        if (!container || document.getElementById('btn-toggle-dithering')) return;

        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = '50%';
        wrapper.style.transform = 'translateX(-50%)';
        wrapper.style.top = '0';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '40px';
        wrapper.style.zIndex = '100';
        wrapper.style.pointerEvents = 'auto';

        // Dithering Button
        const btnDithering = document.createElement('button');
        btnDithering.id = 'btn-toggle-dithering';
        btnDithering.className = 'switch-btn';
        btnDithering.textContent = 'SWITCH VISUALIZZAZIONE';
        this.styleButton(btnDithering);
        btnDithering.onclick = () => this.ditheringManager.toggleOverlay();
        btnDithering.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            this.ditheringManager.toggleOverlay();
        }, { passive: false });

        // Theme Button
        const btnTheme = document.createElement('button');
        btnTheme.id = 'btn-toggle-preview-theme';
        btnTheme.className = 'preview-theme-btn';
        btnTheme.textContent = 'SWITCH PREVIEW THEME';
        this.styleButton(btnTheme);
        btnTheme.onclick = () => this.toggleTheme();
        btnTheme.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            this.toggleTheme();
        }, { passive: false });

        wrapper.appendChild(btnDithering);
        wrapper.appendChild(btnTheme);
        container.appendChild(wrapper);
    }

    styleButton(btn) {
        // Styles now handled in CSS (.switch-btn, .preview-theme-btn)
        // to support theme switching via classes
    }

    toggleTheme() {
        const panel = document.querySelector('.panel-right');
        if (!panel) return;
        panel.classList.toggle('panel-preview-inverted');
        this.panelThemeInverted = panel.classList.contains('panel-preview-inverted');
        this.applyPostProcessing(); // Re-render to update colors
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.rendererPreview && this.scenePreview && this.cameraPreview) {
            this.rendererPreview.render(this.scenePreview, this.cameraPreview);
        }

        if (this.rendererMain && this.sceneMain && this.cameraMain) {
            this.rendererMain.render(this.sceneMain, this.cameraMain);
            this.postProcessor.applyPostProcessing();
        }

        this.ditheringManager.update();
    }

    // Public API Methods (called by UI)
    updateLateralScale(value) {
        this.lateralScale = value;
        if (this.spherePreview) this.spherePreview.scale.z = value;
        if (this.sphereMain) this.sphereMain.scale.z = value;
        this.codeFlow.log('SCALE_Y_UPDATE', value);
    }

    updateRotation(axis, value) {
        this.rotation[axis] = value * (Math.PI / 180);
        if (this.spherePreview) this.spherePreview.rotation[axis] = this.rotation[axis];
        if (this.sphereMain) this.sphereMain.rotation[axis] = this.rotation[axis];
        // Throttle log slightly if possible, but raw log looks cool too
        this.codeFlow.log(`ROTATION_${axis.toUpperCase()}`, value);
    }

    updatePeakCount(count) {
        if (this.peakCount !== count) {
            this.peakCount = count;
            this.sphereGenerator.createSphere(true);
            this.sphereGenerator.createSphere(false);
            this.codeFlow.log('PEAK_COUNT_CHANGE', count);
        }
    }

    updateDisplacement(param, value) {
        this.displacement[param] = value;
        if (this.geometryPreview) this.sphereGenerator.applyDisplacement(this.geometryPreview);
        if (this.geometryMain) this.sphereGenerator.applyDisplacement(this.geometryMain);
        this.codeFlow.log(`DISP_${param.toUpperCase()}`, value);
    }

    updatePostProcessing(param, value) {
        this.postProcessing[param] = value;
        // Effect applied in animate loop
        this.codeFlow.log(`POST_${param.toUpperCase()}`, value);
    }

    applyPostProcessing() {
        this.postProcessor.applyPostProcessing();
    }

    exportPNG() {
        this.postProcessor.exportPNG();
    }
}

// Create and export singleton instance
const app = new App();
// Expose to window for legacy inline scripts/debug
window.Sphere3D = app;

export { app };
