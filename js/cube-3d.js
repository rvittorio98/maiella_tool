// ===== CUBE 3D MODULE =====
// Manages two synchronized 3D cube views:
// - Preview (black panel): 3D rendering with lights
// - Main (right panel): Flat silhouette
// ==========================================

import * as THREE from 'three';

const Cube3D = {
    // === PREVIEW CANVAS (Black Panel - 3D with lights) ===
    scenePreview: null,
    cameraPreview: null,
    rendererPreview: null,
    cubePreview: null,

    // === MAIN CANVAS (Right Panel - Flat silhouette) ===
    sceneMain: null,
    cameraMain: null,
    rendererMain: null,
    cubeMain: null,

    // === SHARED ROTATION STATE ===
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },

    init() {
        this.setupPreview();
        this.setupMain();
        this.animate();
        window.addEventListener('resize', () => this.onResize());
        console.log('✅ Cube3D initialized');
    },

    setupPreview() {
        const canvas = document.getElementById('canvas-preview');
        if (!canvas) return;

        // Scene
        this.scenePreview = new THREE.Scene();
        this.scenePreview.background = new THREE.Color(0x000000);

        // Camera - centered view
        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.cameraPreview = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.cameraPreview.position.set(0, 0, 3);
        this.cameraPreview.lookAt(0, 0, 0);

        // Renderer
        this.rendererPreview = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.rendererPreview.setSize(canvas.clientWidth, canvas.clientHeight);
        this.rendererPreview.setPixelRatio(window.devicePixelRatio);

        // Cube - 3D with lighting (size 1.2 for better visibility)
        const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.6
        });
        this.cubePreview = new THREE.Mesh(geometry, material);
        this.scenePreview.add(this.cubePreview);

        // Lights - Top, Side, Fill
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

        // Scene
        this.sceneMain = new THREE.Scene();
        this.sceneMain.background = new THREE.Color(0xffffff);

        // Camera - adjusted for larger cube
        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.cameraMain = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.cameraMain.position.set(0, 0, 4);
        this.cameraMain.lookAt(0, 0, 0);

        // Renderer
        this.rendererMain = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.rendererMain.setSize(canvas.clientWidth, canvas.clientHeight);
        this.rendererMain.setPixelRatio(window.devicePixelRatio);

        // Cube - Flat silhouette (2x bigger than preview)
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x002a00
        });
        this.cubeMain = new THREE.Mesh(geometry, material);
        this.sceneMain.add(this.cubeMain);

        // NO LIGHTS - flat silhouette only
    },

    updateRotation(axis, value) {
        // Convert slider value (-50 to 50) to radians
        this.rotation[axis] = (value / 50) * Math.PI;
        
        if (this.cubePreview) {
            this.cubePreview.rotation.x = this.rotation.x;
            this.cubePreview.rotation.y = this.rotation.y;
            this.cubePreview.rotation.z = this.rotation.z;
        }

        if (this.cubeMain) {
            this.cubeMain.rotation.x = this.rotation.x;
            this.cubeMain.rotation.y = this.rotation.y;
            this.cubeMain.rotation.z = this.rotation.z;
        }
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.rendererPreview && this.scenePreview && this.cameraPreview) {
            this.rendererPreview.render(this.scenePreview, this.cameraPreview);
        }

        if (this.rendererMain && this.sceneMain && this.cameraMain) {
            this.rendererMain.render(this.sceneMain, this.cameraMain);
        }
    },

    onResize() {
        // Preview canvas
        const canvasPreview = document.getElementById('canvas-preview');
        if (canvasPreview && this.cameraPreview && this.rendererPreview) {
            const aspect = canvasPreview.clientWidth / canvasPreview.clientHeight;
            this.cameraPreview.aspect = aspect;
            this.cameraPreview.updateProjectionMatrix();
            this.rendererPreview.setSize(canvasPreview.clientWidth, canvasPreview.clientHeight);
        }

        // Main canvas
        const canvasMain = document.getElementById('canvas-main');
        if (canvasMain && this.cameraMain && this.rendererMain) {
            const aspect = canvasMain.clientWidth / canvasMain.clientHeight;
            this.cameraMain.aspect = aspect;
            this.cameraMain.updateProjectionMatrix();
            this.rendererMain.setSize(canvasMain.clientWidth, canvasMain.clientHeight);
        }
    }
};

// Make globally available
window.Cube3D = Cube3D;

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Cube3D.init());
} else {
    Cube3D.init();
}