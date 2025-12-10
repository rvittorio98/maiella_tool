import * as THREE from 'three';

export class SceneManager {
    constructor(app) {
        this.app = app;
    }

    setupPreview() {
        const canvas = document.getElementById('canvas-preview');
        if (!canvas) return;

        this.app.scenePreview = new THREE.Scene();
        this.app.scenePreview.background = new THREE.Color(0x000000);

        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.app.cameraPreview = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.app.cameraPreview.position.set(0, 0, 4);
        this.app.cameraPreview.lookAt(0, 0, 0);

        this.app.rendererPreview = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        this.app.rendererPreview.setSize(canvas.clientWidth, canvas.clientHeight);
        this.app.rendererPreview.setPixelRatio(window.devicePixelRatio);

        // Initial sphere creation is handled by App calling SphereGenerator, 
        // but we need to ensure lights are added.

        const lightTop = new THREE.DirectionalLight(0xffffff, 1.2);
        lightTop.position.set(0, 5, 3);
        this.app.scenePreview.add(lightTop);

        const lightSide = new THREE.DirectionalLight(0xffffff, 0.8);
        lightSide.position.set(-3, 2, 2);
        this.app.scenePreview.add(lightSide);

        const lightFill = new THREE.DirectionalLight(0xffffff, 0.3);
        lightFill.position.set(2, -2, -2);
        this.app.scenePreview.add(lightFill);

        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.app.scenePreview.add(ambient);
    }

    setupMain() {
        const canvas = document.getElementById('canvas-main');
        if (!canvas) return;

        this.app.sceneMain = new THREE.Scene();
        this.app.sceneMain.background = new THREE.Color(0xffffff);

        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const aspect = canvas.clientWidth / canvas.clientHeight;
        this.app.cameraMain = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.app.cameraMain.position.set(0, 0, 5.5);
        this.app.cameraMain.lookAt(0, 0, 0);

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;

        this.app.rendererMain = new THREE.WebGLRenderer({
            canvas: offscreenCanvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.app.rendererMain.setSize(canvas.clientWidth, canvas.clientHeight);
        this.app.rendererMain.setPixelRatio(window.devicePixelRatio);

        this.app.tempCanvasMain = offscreenCanvas;
        this.app.displayCanvas = canvas;
        this.app.tempCtx = canvas.getContext('2d', { willReadFrequently: true });

        const lightTop = new THREE.DirectionalLight(0xffffff, 1.5);
        lightTop.position.set(0, 5, 3);
        this.app.sceneMain.add(lightTop);

        const lightSide = new THREE.DirectionalLight(0xffffff, 0.6);
        lightSide.position.set(-3, 2, 2);
        this.app.sceneMain.add(lightSide);

        const ambient = new THREE.AmbientLight(0xffffff, 0.3);
        this.app.sceneMain.add(ambient);
    }

    onResize() {
        const canvasPreview = document.getElementById('canvas-preview');
        if (canvasPreview && this.app.cameraPreview && this.app.rendererPreview) {
            const aspect = canvasPreview.clientWidth / canvasPreview.clientHeight;
            this.app.cameraPreview.aspect = aspect;
            this.app.cameraPreview.updateProjectionMatrix();
            this.app.rendererPreview.setSize(canvasPreview.clientWidth, canvasPreview.clientHeight);
        }

        if (this.app.displayCanvas && this.app.cameraMain && this.app.rendererMain) {
            const aspect = this.app.displayCanvas.clientWidth / this.app.displayCanvas.clientHeight;
            this.app.cameraMain.aspect = aspect;
            this.app.cameraMain.updateProjectionMatrix();
            this.app.rendererMain.setSize(this.app.displayCanvas.clientWidth, this.app.displayCanvas.clientHeight);

            if (this.app.tempCanvasMain) {
                this.app.tempCanvasMain.width = this.app.displayCanvas.clientWidth;
                this.app.tempCanvasMain.height = this.app.displayCanvas.clientHeight;
            }
        }
    }
}
