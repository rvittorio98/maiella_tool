// Manages two synchronized 3D sphere views with organic displacement:
// - Preview (black panel): 3D rendering with lights
// - Main (right panel): Flat silhouette
// ==========================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// === Dithering & Overlay Globals ===
const ditheringParams = {
    cellSize: 7,
    color: '#002a00',
    maxRadiusRatio: 0.8,
    charSet: {
        light: [' ', '.', '·', ':', '¸', ';', '!', '|'],
        medium: ['i', 'l', 'I', '/', '\\', 't', 'r', 'f', '1', 'c', 'v', 'x', 'n', 'u', 'z', 'o', 's', 'a', 'e'],
        dense: ['L', 'C', 'J', 'U', 'Y', 'X', 'Z', 'O', '0', 'Q', 'G', 'D', 'H', 'K', 'A', 'N', 'M', 'W', '#']
    },
    getCharForBrightness: function (brightness, x, y, time) {
        // Animation strictly depends on timeSeed for slower, predictable updates
        const timeSeed = Math.floor(time / 50); // Slow update (8s)
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
    },
    getMaxRadiusRatio: function () {
        if (asciiOverlayEnabled && window.Sphere3D) {
            const thresholdValue = window.Sphere3D.postProcessing.threshold;
            return 0.2 + (thresholdValue / 40) * 1.3;
        }
        return this.maxRadiusRatio;
    },
    getMorphLevel: function () {
        if (asciiOverlayEnabled && window.Sphere3D) {
            return window.Sphere3D.postProcessing.blur;
        }
        return 0;
    }
};

// Variabili globali per overlay ASCII
let asciiOverlayEnabled = false;
let previousThreshold = 15;
let previousBlur = 0;

window.updateAsciiOverlayAfterRender = function () {
    if (!asciiOverlayEnabled) return;
    showAsciiSphereOverlay();
};

function toggleAsciiOverlay() {
    asciiOverlayEnabled = !asciiOverlayEnabled;
    const overlay = document.getElementById('ascii-overlay');
    const mainCanvas = document.getElementById('canvas-main');

    if (overlay) {
        if (asciiOverlayEnabled) {
            overlay.style.display = 'block';
        } else {
            // Remove overlay from DOM when switching back
            overlay.parentElement?.removeChild(overlay);
        }
    }

    if (mainCanvas) {
        mainCanvas.style.opacity = asciiOverlayEnabled ? '0' : '1';
    }

    if (window.Sphere3D) {
        const thresholdLabel = document.querySelector('label[for="threshold"]');
        const thresholdValue = document.getElementById('value-threshold');
        const blurLabel = document.querySelector('label[for="blur"]');

        if (asciiOverlayEnabled) {
            previousThreshold = window.Sphere3D.postProcessing.threshold;
            previousBlur = window.Sphere3D.postProcessing.blur;
            window.Sphere3D.updatePostProcessing('blur', 0);

            if (thresholdLabel) thresholdLabel.textContent = 'SCALE';
            if (thresholdValue) thresholdValue.textContent = previousThreshold;
            if (blurLabel) blurLabel.textContent = 'MORPH';
        } else {
            window.Sphere3D.updatePostProcessing('threshold', previousThreshold);
            window.Sphere3D.updatePostProcessing('blur', previousBlur);

            if (thresholdLabel) thresholdLabel.textContent = 'THRESHOLD';
            if (thresholdValue) thresholdValue.textContent = previousThreshold;
            if (blurLabel) blurLabel.textContent = 'BLUR';

            // Force re-render of main view
            if (typeof window.Sphere3D.applyPostProcessing === 'function') {
                window.Sphere3D.applyPostProcessing();
            }
        }
    }
}

function showAsciiSphereOverlay() {
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

    // Read from grayscale data BEFORE threshold was applied
    if (!window.Sphere3D || !window.Sphere3D.grayscaleImageData) return;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = window.Sphere3D.grayscaleImageData;
    const data = imageData.data;

    const cellSize = ditheringParams.cellSize;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const time = Date.now();
    const morphLevel = ditheringParams.getMorphLevel();
    const morphRatio = morphLevel / 30;

    ctx.fillStyle = ditheringParams.color;
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
                    const charData = ditheringParams.getCharForBrightness(brightness, x, y, time);

                    // Reduce text size, keep spheres unchanged
                    if (charData.type === 'dense') {
                        ctx.font = `bold ${cellSize * 1.1}px 'Roboto Mono'`;
                    } else {
                        ctx.font = `${cellSize * 1.1}px 'Roboto Mono'`;
                    }

                    ctx.fillText(charData.char, px + cellSize / 2, py + cellSize / 2);
                } else {
                    // Discrete circle sizes for stronger visual differentiation
                    // We map brightness -> one of five radii (smallest -> largest).
                    // Darker pixels (brightness closer to 0) get larger circles.
                    const maxRatio = ditheringParams.getMaxRadiusRatio();
                    const sizes = [
                        cellSize * 0.12 * maxRatio, // smallest
                        cellSize * 0.25 * maxRatio, // small-medium (new)
                        cellSize * 0.40 * maxRatio, // medium
                        cellSize * 0.60 * maxRatio, // medium-large (new)
                        cellSize * 0.90 * maxRatio  // largest
                    ];

                    // Invert brightness so 0=>largest index, 1=>smallest index
                    let idx = Math.floor((1 - brightness) * sizes.length);
                    if (idx < 0) idx = 0;
                    if (idx >= sizes.length) idx = sizes.length - 1;

                    const radius = sizes[idx];

                    if (radius > 0.05) {
                        ctx.beginPath();
                        ctx.arc(px + cellSize / 2, py + cellSize / 2, radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
    }
}

function createDitheringButton() {
    const container = document.querySelector('.panel-right-top');
    if (!container || document.getElementById('btn-toggle-dithering')) return;

    // Create a centered wrapper and place both buttons inside with 40px gap
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '50%';
    wrapper.style.transform = 'translateX(-50%)';
    wrapper.style.top = '0';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '40px';
    wrapper.style.zIndex = '100'; // Ensure it's above everything
    wrapper.style.pointerEvents = 'auto'; // Ensure it captures clicks

    const btn = document.createElement('button');
    btn.id = 'btn-toggle-dithering';
    btn.className = 'switch-btn';
    btn.textContent = 'SWITCH VISUALIZZAZIONE';
    btn.style.backgroundColor = 'transparent';
    btn.style.color = '#002a00';
    btn.style.border = '1px solid #002a00';
    btn.style.padding = '2px 8px';
    btn.style.fontSize = '10px';
    btn.style.cursor = 'pointer';
    btn.style.fontFamily = 'inherit';
    btn.style.pointerEvents = 'auto'; // Explicitly allow pointer events
    btn.onclick = toggleAsciiOverlay;
    // Touch support for mobile
    btn.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Prevent ghost click
        e.stopPropagation(); // Stop bubbling
        toggleAsciiOverlay();
    }, { passive: false });
    // let the wrapper manage positioning

    // Add preview panel theme toggle button
    const btnPreviewTheme = document.createElement('button');
    btnPreviewTheme.id = 'btn-toggle-preview-theme';
    btnPreviewTheme.className = 'preview-theme-btn';
    btnPreviewTheme.textContent = 'SWITCH PREVIEW THEME';
    btnPreviewTheme.style.backgroundColor = 'transparent';
    btnPreviewTheme.style.color = '#002a00';
    btnPreviewTheme.style.border = '1px solid #002a00';
    btnPreviewTheme.style.padding = '2px 8px';
    btnPreviewTheme.style.fontSize = '10px';
    btnPreviewTheme.style.cursor = 'pointer';
    btnPreviewTheme.style.fontFamily = 'inherit';
    btnPreviewTheme.style.pointerEvents = 'auto'; // Explicitly allow pointer events
    btnPreviewTheme.onclick = function () {
        var panel = document.querySelector('.panel-right');
        if (!panel) {
            btnPreviewTheme.disabled = true;
            btnPreviewTheme.style.opacity = '0.5';
            console.error('togglePreviewPanelTheme: .panel-right not found in DOM. Please check your HTML.');
            return;
        }
        togglePreviewPanelTheme();
    };
    // Touch support for mobile
    btnPreviewTheme.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Prevent ghost click
        e.stopPropagation(); // Stop bubbling
        var panel = document.querySelector('.panel-right');
        if (!panel) {
            btnPreviewTheme.disabled = true;
            btnPreviewTheme.style.opacity = '0.5';
            console.error('togglePreviewPanelTheme: .panel-right not found in DOM. Please check your HTML.');
            return;
        }
        togglePreviewPanelTheme();
    }, { passive: false });

    wrapper.appendChild(btn);
    wrapper.appendChild(btnPreviewTheme);
    container.appendChild(wrapper);
    // Toggle left panel (preview) theme: invert background, canvas, and text colors
    function togglePreviewPanelTheme() {
        var panel = document.querySelector('.panel-right');
        if (!panel) {
            console.error('togglePreviewPanelTheme: .panel-right not found in DOM. Please check your HTML.');
            return;
        }
        panel.classList.toggle('panel-preview-inverted');

        // Change panel background
        if (panel.classList.contains('panel-preview-inverted')) {
            panel.style.background = '#002a00';
        } else {
            panel.style.background = '#fff';
        }

        // Also invert canvas background if needed
        var mainCanvas = document.getElementById('canvas-main');
        if (mainCanvas) {
            if (panel.classList.contains('panel-preview-inverted')) {
                mainCanvas.style.background = '#002a00';
            } else {
                mainCanvas.style.background = '#fff';
            }
        }

        // Invert all text colors inside the panel
        var texts = panel.querySelectorAll('*');
        texts.forEach(function (el) {
            if (panel.classList.contains('panel-preview-inverted')) {
                el.style.color = '#fff';
                if (el.tagName === 'BUTTON') {
                    el.style.border = '1px solid #fff';
                }
            } else {
                el.style.color = '#002a00';
                if (el.tagName === 'BUTTON') {
                    el.style.border = '1px solid #002a00';
                }
            }
        });

        // Change dithering overlay color and threshold color
        if (panel.classList.contains('panel-preview-inverted')) {
            ditheringParams.color = '#fff';
            // If you have a threshold color variable, set it here
        } else {
            ditheringParams.color = '#002a00';
        }

        // Set color inversion flag for threshold/dithering
        window.Sphere3D.panelThemeInverted = panel.classList.contains('panel-preview-inverted');
        // Force re-render of main canvas to apply new color
        if (typeof window.Sphere3D.applyPostProcessing === 'function') {
            window.Sphere3D.applyPostProcessing();
        }
    }
    // Toggle visibility of preview canvas (black/negative panel)
    function togglePreviewCanvas() {
        const previewCanvas = document.getElementById('canvas-preview');
        if (previewCanvas) {
            previewCanvas.style.display = (previewCanvas.style.display === 'none') ? 'block' : 'none';
        }
    }
}

const Sphere3D = {
    scenePreview: null,
    cameraPreview: null,
    rendererPreview: null,
    spherePreview: null,
    geometryPreview: null,
    sceneMain: null,
    cameraMain: null,
    rendererMain: null,
    sphereMain: null,
    geometryMain: null,
    rotation: { y: -0.5 * Math.PI },
    lateralScale: 1.0,
    peakCount: 1,
    displacement: { roughness: 50, scale: 50, detail: 50 },
    postProcessing: { contrast: 10, blur: 0, threshold: 15 },
    tempCanvasMain: null,
    displayCanvas: null,
    tempCtx: null,

    init() {
        this.setupPreview();
        this.setupMain();
        this.animate();
        window.addEventListener('resize', () => this.onResize());
        createDitheringButton();
        console.log('✅ Sphere3D initialized');
    },

    setupPreview() {
        const canvas = document.getElementById('canvas-preview');
        if (!canvas) return;

        this.scenePreview = new THREE.Scene();
        this.scenePreview.background = new THREE.Color(0x000000);

        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.cameraPreview = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.cameraPreview.position.set(0, 0, 4);
        this.cameraPreview.lookAt(0, 0, 0);

        this.rendererPreview = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        this.rendererPreview.setSize(canvas.clientWidth, canvas.clientHeight);
        this.rendererPreview.setPixelRatio(window.devicePixelRatio);

        this.createSphere(true);

        const lightTop = new THREE.DirectionalLight(0xffffff, 1.2);
        lightTop.position.set(0, 5, 3);
        this.scenePreview.add(lightTop);

        const lightSide = new THREE.DirectionalLight(0xffffff, 0.8);
        lightSide.position.set(-3, 2, 2);
        this.scenePreview.add(lightSide);

        const lightFill = new THREE.DirectionalLight(0xffffff, 0.3);
        lightFill.position.set(2, -2, -2);
        this.scenePreview.add(lightFill);

        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scenePreview.add(ambient);
    },

    setupMain() {
        const canvas = document.getElementById('canvas-main');
        if (!canvas) return;

        this.sceneMain = new THREE.Scene();
        this.sceneMain.background = new THREE.Color(0xffffff);

        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.cameraMain = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.cameraMain.position.set(0, 0, 5.5);
        this.cameraMain.lookAt(0, 0, 0);

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;

        this.rendererMain = new THREE.WebGLRenderer({
            canvas: offscreenCanvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.rendererMain.setSize(canvas.clientWidth, canvas.clientHeight);
        this.rendererMain.setPixelRatio(window.devicePixelRatio);

        this.tempCanvasMain = offscreenCanvas;
        this.displayCanvas = canvas;
        this.tempCtx = canvas.getContext('2d', { willReadFrequently: true });

        this.createSphere(false);

        const lightTop = new THREE.DirectionalLight(0xffffff, 1.5);
        lightTop.position.set(0, 5, 3);
        this.sceneMain.add(lightTop);

        const lightSide = new THREE.DirectionalLight(0xffffff, 0.6);
        lightSide.position.set(-3, 2, 2);
        this.sceneMain.add(lightSide);

        const ambient = new THREE.AmbientLight(0xffffff, 0.3);
        this.sceneMain.add(ambient);
    },

    createSphere(isPreview) {
        const loader = new GLTFLoader();
        const modelPath = `asset/momntagna_0${this.peakCount}.glb`;

        loader.load(modelPath, (gltf) => {
            let geometry = null;
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    geometry = child.geometry.clone();
                }
            });

            if (!geometry) {
                console.error('No mesh found in GLB');
                return;
            }

            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);
            geometry.translate(-center.x, -center.y, -center.z);

            const fixedScale = isPreview ? 0.75 : 1.25;
            geometry.scale(fixedScale, fixedScale, fixedScale);

            this.createMeshFromGeometry(geometry, isPreview);
        }, undefined, (error) => {
            console.error('Error loading GLB:', error);
        });
    },

    createMeshFromGeometry(geometry, isPreview) {
        this.applyDisplacement(geometry);
        geometry.computeVertexNormals();

        if (isPreview) {
            if (this.spherePreview) this.scenePreview.remove(this.spherePreview);
            if (this.geometryPreview) this.geometryPreview?.dispose();

            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                metalness: 0.1,
                roughness: 0.6,
                flatShading: false
            });

            this.spherePreview = new THREE.Mesh(geometry, material);
            this.spherePreview.scale.set(1, 1, this.lateralScale);
            this.spherePreview.rotation.y = this.rotation.y;

            this.scenePreview.add(this.spherePreview);
            this.geometryPreview = geometry;
        } else {
            if (this.sphereMain) this.sceneMain.remove(this.sphereMain);
            if (this.geometryMain) this.geometryMain?.dispose();

            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                metalness: 0,
                roughness: 0.8,
                flatShading: false
            });

            this.sphereMain = new THREE.Mesh(geometry, material);
            this.sphereMain.scale.set(1, 1, this.lateralScale);
            this.sphereMain.rotation.y = this.rotation.y;

            this.sceneMain.add(this.sphereMain);
            this.geometryMain = geometry;
        }
    },

    applyDisplacement(geometry) {
        const positions = geometry.attributes.position;
        const scale = (this.displacement.scale / 100) * 0.4;
        const frequency = 1 + (this.displacement.roughness / 100) * 8;
        const octaves = Math.floor(1 + (this.displacement.detail / 100) * 4);

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);

            let noise = 0;
            let amplitude = 1;
            let freq = frequency;

            for (let oct = 0; oct < octaves; oct++) {
                noise +=
                    (Math.sin(x * freq + y * freq * 0.7) * 0.3 +
                        Math.sin(y * freq * 1.3 + z * freq) * 0.2 +
                        Math.sin(z * freq * 0.8 + x * freq * 1.5) * 0.25 +
                        Math.sin(x * y * z * freq * 0.2) * 0.15) * amplitude;

                freq *= 2;
                amplitude *= 0.5;
            }

            const displacement = noise * scale;
            const length = Math.sqrt(x * x + y * y + z * z);
            const factor = 1 + displacement;

            positions.setXYZ(
                i,
                (x / length) * length * factor,
                (y / length) * length * factor,
                (z / length) * length * factor
            );
        }

        geometry.computeVertexNormals();
    },

    updateRotation(axis, value) {
        this.rotation[axis] = (value / 50) * Math.PI;

        if (this.spherePreview) {
            this.spherePreview.rotation[axis] = this.rotation[axis];
        }

        if (this.sphereMain) {
            this.sphereMain.rotation[axis] = this.rotation[axis];
        }
    },

    updateLateralScale(value) {
        this.lateralScale = value;

        if (this.spherePreview) {
            this.spherePreview.scale.set(1, 1, this.lateralScale);
        }

        if (this.sphereMain) {
            this.sphereMain.scale.set(1, 1, this.lateralScale);
        }
    },

    updatePeakCount(value) {
        this.peakCount = value;
        this.createSphere(true);
        this.createSphere(false);
    },

    updateDisplacement(type, value) {
        this.displacement[type] = value;
        this.createSphere(true);
        this.createSphere(false);
    },

    updatePostProcessing(type, value) {
        this.postProcessing[type] = value;
    },

    applyPostProcessing() {
        if (!this.tempCtx || !this.tempCanvasMain || !this.displayCanvas) return;

        const width = this.displayCanvas.width;
        const height = this.displayCanvas.height;

        this.tempCtx.clearRect(0, 0, width, height);
        this.tempCtx.drawImage(this.tempCanvasMain, 0, 0, width, height);

        let imageData = this.tempCtx.getImageData(0, 0, width, height);
        let data = imageData.data;

        // Increase contrast range for stronger effect
        const contrast = this.postProcessing.contrast * 2.5; // was 1x, now 2.5x for more contrast
        const factor = (contrast > 0) ? (259 * (contrast + 255)) / ((255 - contrast) * 255) : 1;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = factor * (data[i] - 128) + 128;
            data[i + 1] = factor * (data[i + 1] - 128) + 128;
            data[i + 2] = factor * (data[i + 2] - 128) + 128;
        }
        this.tempCtx.putImageData(imageData, 0, 0);

        if (this.postProcessing.blur > 0 && !asciiOverlayEnabled) {
            const blurAmount = this.postProcessing.blur;
            this.tempCtx.filter = `blur(${blurAmount}px)`;
            this.tempCtx.drawImage(this.displayCanvas, 0, 0, width, height);
            this.tempCtx.filter = 'none';
        }

        // CRITICAL: Save grayscale data BEFORE threshold for dithering
        // Store this so dithering can read brightness gradations instead of just black/white
        this.grayscaleImageData = this.tempCtx.getImageData(0, 0, width, height);

        const finalData = this.tempCtx.getImageData(0, 0, width, height);
        const finalPixels = finalData.data;
        const threshold = (this.postProcessing.threshold / 40) * 255;
        const invertTheme = !!window.Sphere3D.panelThemeInverted;

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

        this.tempCtx.putImageData(finalData, 0, 0);
    },

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.rendererPreview && this.scenePreview && this.cameraPreview) {
            this.rendererPreview.render(this.scenePreview, this.cameraPreview);
        }

        if (this.rendererMain && this.sceneMain && this.cameraMain) {
            this.rendererMain.render(this.sceneMain, this.cameraMain);
            this.applyPostProcessing();
        }

        if (typeof window.updateAsciiOverlayAfterRender === 'function') {
            window.updateAsciiOverlayAfterRender();
        }
    },

    onResize() {
        const canvasPreview = document.getElementById('canvas-preview');
        if (canvasPreview && this.cameraPreview && this.rendererPreview) {
            const aspect = canvasPreview.clientWidth / canvasPreview.clientHeight;
            this.cameraPreview.aspect = aspect;
            this.cameraPreview.updateProjectionMatrix();
            this.rendererPreview.setSize(canvasPreview.clientWidth, canvasPreview.clientHeight);
        }

        if (this.displayCanvas && this.cameraMain && this.rendererMain) {
            const aspect = this.displayCanvas.clientWidth / this.displayCanvas.clientHeight;
            this.cameraMain.aspect = aspect;
            this.cameraMain.updateProjectionMatrix();
            this.rendererMain.setSize(this.displayCanvas.clientWidth, this.displayCanvas.clientHeight);

            if (this.tempCanvasMain) {
                this.tempCanvasMain.width = this.displayCanvas.clientWidth;
                this.tempCanvasMain.height = this.displayCanvas.clientHeight;
            }
        }
    },

    renderHighRes(scale = 4) {
        const exportCanvas = document.createElement('canvas');
        const baseWidth = this.displayCanvas.width;
        const baseHeight = this.displayCanvas.height;
        exportCanvas.width = baseWidth * scale;
        exportCanvas.height = baseHeight * scale;

        const exportRenderer = new THREE.WebGLRenderer({
            canvas: exportCanvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        exportRenderer.setSize(exportCanvas.width, exportCanvas.height);
        exportRenderer.render(this.sceneMain, this.cameraMain);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportCanvas.width;
        tempCanvas.height = exportCanvas.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        tempCtx.drawImage(exportCanvas, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        const contrast = (this.postProcessing.contrast / 50) * 2;
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        for (let i = 0; i < data.length; i += 4) {
            data[i] = factor * (data[i] - 128) + 128;
            data[i + 1] = factor * (data[i + 1] - 128) + 128;
            data[i + 2] = factor * (data[i + 2] - 128) + 128;
        }
        tempCtx.putImageData(imageData, 0, 0);

        if (this.postProcessing.blur > 0) {
            const blurAmount = this.postProcessing.blur * scale;
            tempCtx.filter = `blur(${blurAmount}px)`;
            tempCtx.drawImage(tempCanvas, 0, 0);
            tempCtx.filter = 'none';
        }

        const finalData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const finalPixels = finalData.data;
        const threshold = (this.postProcessing.threshold / 50) * 255;
        for (let i = 0; i < finalPixels.length; i += 4) {
            const avg = (finalPixels[i] + finalPixels[i + 1] + finalPixels[i + 2]) / 3;
            if (avg > threshold) {
                finalPixels[i] = 255;
                finalPixels[i + 1] = 255;
                finalPixels[i + 2] = 255;
            } else {
                finalPixels[i] = 0;
                finalPixels[i + 1] = 42;
                finalPixels[i + 2] = 0;
            }
        }
        tempCtx.putImageData(finalData, 0, 0);

        exportRenderer.dispose();
        return tempCanvas;
    },

    exportPNG() {
        if (!this.displayCanvas) return;

        const highResCanvas = this.renderHighRes(4);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = highResCanvas.width;
        tempCanvas.height = highResCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        const imageData = tempCtx.createImageData(highResCanvas.width, highResCanvas.height);
        const srcCtx = highResCanvas.getContext('2d');
        const srcData = srcCtx.getImageData(0, 0, highResCanvas.width, highResCanvas.height).data;
        const data = imageData.data;

        for (let i = 0; i < srcData.length; i += 4) {
            const brightness = (srcData[i] + srcData[i + 1] + srcData[i + 2]) / 3;
            if (brightness < 128) {
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
                data[i + 3] = 255;
            } else {
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
                data[i + 3] = 0;
            }
        }

        tempCtx.putImageData(imageData, 0, 0);

        const link = document.createElement('a');
        link.download = `maiella-sphere-${Date.now()}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    },

    exportSVG() {
        if (!this.displayCanvas) return;

        const highResCanvas = this.renderHighRes(4);
        const ctx = highResCanvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, highResCanvas.width, highResCanvas.height);
        const data = imageData.data;
        const w = highResCanvas.width;
        const h = highResCanvas.height;

        const binary = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const isGreen = data[idx] < 10 && data[idx + 1] > 30 && data[idx + 1] < 50 && data[idx + 2] < 10;
                binary[y * w + x] = isGreen ? 1 : 0;
            }
        }

        const visited = new Uint8Array(w * h);
        const regions = [];

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                if (visited[idx] || binary[idx] === 0) continue;

                const region = this.floodFillRegion(binary, visited, w, h, x, y);
                if (region.pixels > 500) {
                    regions.push(region);
                }
            }
        }

        regions.sort((a, b) => b.pixels - a.pixels);

        if (regions.length === 0) {
            console.error('No regions found');
            return;
        }

        let shapeBBoxMinX = w, shapeBBoxMaxX = 0, shapeBBoxMinY = h, shapeBBoxMaxY = 0;

        shapeBBoxMinX = Math.max(0, shapeBBoxMinX);
        shapeBBoxMinY = Math.max(0, shapeBBoxMinY);
        shapeBBoxMaxX = Math.min(w, shapeBBoxMaxX);
        shapeBBoxMaxY = Math.min(h, shapeBBoxMaxY);
        const viewWidth = shapeBBoxMaxX - shapeBBoxMinX;
        const viewHeight = shapeBBoxMaxY - shapeBBoxMinY;

        let pathData = '';
        let maxPixels = 0;
        regions.forEach(region => {
            let touchesBorder = false;
            for (const idx of region.coords) {
                const x = idx % w;
                const y = Math.floor(idx / w);
                if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
                    touchesBorder = true;
                    break;
                }
            }
            if (!touchesBorder && region.pixels > maxPixels) maxPixels = region.pixels;
        });
        regions.forEach((region, regionIndex) => {
            let touchesBorder = false;
            for (const idx of region.coords) {
                const x = idx % w;
                const y = Math.floor(idx / w);
                if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
                    touchesBorder = true;
                    break;
                }
            }
            if (touchesBorder) return;
            const regionSet = new Set(region.coords);
            const regionBinary = new Uint8Array(w * h);
            region.coords.forEach(coord => {
                regionBinary[coord] = 1;
            });
            const outerContour = this.extractOuterContour(regionBinary, w, h);
            if (!outerContour || outerContour.length < 10) return;
            outerContour.forEach(p => {
                shapeBBoxMinX = Math.min(shapeBBoxMinX, p.x);
                shapeBBoxMaxX = Math.max(shapeBBoxMaxX, p.x);
                shapeBBoxMinY = Math.min(shapeBBoxMinY, p.y);
                shapeBBoxMaxY = Math.max(shapeBBoxMaxY, p.y);
            });
            const simplifiedOuter = this.rdpSimplify(outerContour, 4.0);
            const offsetOuter = simplifiedOuter.map(p => ({ x: p.x - shapeBBoxMinX, y: p.y - shapeBBoxMinY }));
            pathData += this.toBezierPath(offsetOuter);
            const holes = [];
            const holeVisited = new Uint8Array(w * h);
            let minX = w, maxX = 0, minY = h, maxY = 0;
            region.coords.forEach(idx => {
                const x = idx % w;
                const y = Math.floor(idx / w);
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            });
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const idx = y * w + x;
                    if (holeVisited[idx] || binary[idx] === 1) continue;
                    let hasGreenNeighbor = false;
                    for (let dy = -1; dy <= 1 && !hasGreenNeighbor; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const neighborIdx = (y + dy) * w + (x + dx);
                            if (regionSet.has(neighborIdx)) {
                                hasGreenNeighbor = true;
                                break;
                            }
                        }
                    }
                    if (hasGreenNeighbor) {
                        const holeRegion = this.floodFillRegion(binary, holeVisited, w, h, x, y, 0);
                        if (holeRegion.pixels > 200) {
                            holes.push(holeRegion);
                        }
                    }
                }
            }
            holes.forEach(hole => {
                const holeBinary = new Uint8Array(w * h);
                hole.coords.forEach(coord => {
                    holeBinary[coord] = 1;
                });
                const holeContour = this.extractOuterContour(holeBinary, w, h);
                if (holeContour && holeContour.length > 10) {
                    const simplifiedHole = this.rdpSimplify(holeContour, 4.0);
                    const reversed = simplifiedHole.slice().reverse();
                    const offsetHole = reversed.map(p => ({ x: p.x - shapeBBoxMinX, y: p.y - shapeBBoxMinY }));
                    pathData += ' ' + this.toBezierPath(offsetHole);
                }
            });
        });

        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}">
    <path d="${pathData}" fill="#002a00" fill-rule="evenodd"/>
</svg>`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `maiella-sphere-${Date.now()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    },

    floodFillRegion(binary, visited, w, h, startX, startY, targetValue = 1) {
        const stack = [{ x: startX, y: startY }];
        const coords = [];
        let pixels = 0;

        if (targetValue === undefined) {
            targetValue = binary[startY * w + startX];
        }

        while (stack.length > 0) {
            const { x, y } = stack.pop();
            const idx = y * w + x;

            if (x < 0 || x >= w || y < 0 || y >= h) continue;
            if (visited[idx] || binary[idx] !== targetValue) continue;

            visited[idx] = 1;
            coords.push(idx);
            pixels++;

            stack.push({ x: x + 1, y: y });
            stack.push({ x: x - 1, y: y });
            stack.push({ x: x, y: y + 1 });
            stack.push({ x: x, y: y - 1 });
        }

        return { pixels, coords };
    },

    extractOuterContour(binary, w, h) {
        let startX = -1, startY = -1;

        for (let y = 0; y < h && startY === -1; y++) {
            for (let x = 0; x < w; x++) {
                if (binary[y * w + x] === 1) {
                    startX = x;
                    startY = y;
                    break;
                }
            }
        }

        if (startX === -1) return null;

        const contour = [];
        let x = startX, y = startY;
        let dir = 7;
        const directions = [
            { dx: 1, dy: 0 },
            { dx: 1, dy: 1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: -1, dy: -1 },
            { dx: 0, dy: -1 },
            { dx: 1, dy: -1 }
        ];

        let steps = 0;
        const maxSteps = w * h;

        do {
            contour.push({ x, y });

            let found = false;
            for (let i = 0; i < 8; i++) {
                const checkDir = (dir + i) % 8;
                const nx = x + directions[checkDir].dx;
                const ny = y + directions[checkDir].dy;

                if (nx >= 0 && nx < w && ny >= 0 && ny < h && binary[ny * w + nx] === 1) {
                    x = nx;
                    y = ny;
                    dir = (checkDir + 5) % 8;
                    found = true;
                    break;
                }
            }

            if (!found) break;
            steps++;

        } while ((x !== startX || y !== startY) && steps < maxSteps);

        return contour;
    },

    toBezierPath(points) {
        if (points.length < 3) return '';

        let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

        for (let i = 0; i < points.length; i++) {
            const p0 = points[(i - 1 + points.length) % points.length];
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const p3 = points[(i + 2) % points.length];

            const tension = 0.5;
            const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
            const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
            const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
            const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

            path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
        }

        path += ' Z';
        return path;
    },

    rdpSimplify(points, epsilon) {
        if (points.length < 3) return points;

        let maxDist = 0, maxIdx = 0;
        const first = points[0], last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const p = points[i];
            const dx = last.x - first.x;
            const dy = last.y - first.y;
            const norm = Math.sqrt(dx * dx + dy * dy);

            const dist = norm === 0
                ? Math.hypot(p.x - first.x, p.y - first.y)
                : Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / norm;

            if (dist > maxDist) {
                maxDist = dist;
                maxIdx = i;
            }
        }

        if (maxDist > epsilon) {
            const left = this.rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
            const right = this.rdpSimplify(points.slice(maxIdx), epsilon);
            return left.slice(0, -1).concat(right);
        }

        return [first, last];
    }
};

window.Sphere3D = Sphere3D;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Sphere3D.init();
        // Ensure theme button is created after DOM is ready
        setTimeout(() => {
            if (typeof createDitheringButton === 'function') {
                createDitheringButton();
            }
        }, 100);
    });
} else {
    Sphere3D.init();
    setTimeout(() => {
        if (typeof createDitheringButton === 'function') {
            createDitheringButton();
        }
    }, 100);
}
