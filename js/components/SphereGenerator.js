import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class SphereGenerator {
    constructor(app) {
        this.app = app;
    }

    createSphere(isPreview) {
        const loader = new GLTFLoader();
        // Access state from app
        const modelPath = `asset/momntagna_0${this.app.peakCount}.glb`;

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
    }

    createMeshFromGeometry(geometry, isPreview) {
        // Store original positions for non-destructive displacement
        if (!geometry.userData.originalPositions) {
            const count = geometry.attributes.position.count;
            geometry.userData.originalPositions = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                geometry.userData.originalPositions[i * 3] = geometry.attributes.position.getX(i);
                geometry.userData.originalPositions[i * 3 + 1] = geometry.attributes.position.getY(i);
                geometry.userData.originalPositions[i * 3 + 2] = geometry.attributes.position.getZ(i);
            }
        }

        this.applyDisplacement(geometry);
        geometry.computeVertexNormals();

        if (isPreview) {
            if (this.app.spherePreview) this.app.scenePreview.remove(this.app.spherePreview);
            if (this.app.geometryPreview) this.app.geometryPreview.dispose();

            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                metalness: 0.1,
                roughness: 0.6,
                flatShading: false
            });

            this.app.spherePreview = new THREE.Mesh(geometry, material);
            this.app.spherePreview.scale.set(1, 1, this.app.lateralScale);
            this.app.spherePreview.rotation.y = this.app.rotation.y;

            this.app.scenePreview.add(this.app.spherePreview);
            this.app.geometryPreview = geometry;
        } else {
            if (this.app.sphereMain) this.app.sceneMain.remove(this.app.sphereMain);
            if (this.app.geometryMain) this.app.geometryMain.dispose();

            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                metalness: 0,
                roughness: 0.8,
                flatShading: false
            });

            this.app.sphereMain = new THREE.Mesh(geometry, material);
            this.app.sphereMain.scale.set(1, 1, this.app.lateralScale);
            this.app.sphereMain.rotation.y = this.app.rotation.y;

            this.app.sceneMain.add(this.app.sphereMain);
            this.app.geometryMain = geometry;
        }
    }

    applyDisplacement(geometry) {
        if (!geometry.userData.originalPositions) return;

        const positions = geometry.attributes.position;
        const originalPositions = geometry.userData.originalPositions;
        const scale = (this.app.displacement.scale / 100) * 0.4;
        const frequency = 1 + (this.app.displacement.roughness / 100) * 8;
        const octaves = Math.floor(1 + (this.app.displacement.detail / 100) * 4);

        for (let i = 0; i < positions.count; i++) {
            // Read from original positions
            const x = originalPositions[i * 3];
            const y = originalPositions[i * 3 + 1];
            const z = originalPositions[i * 3 + 2];

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

            // Write to current positions
            positions.setXYZ(
                i,
                (x / length) * length * factor,
                (y / length) * length * factor,
                (z / length) * length * factor
            );
        }

        positions.needsUpdate = true;
        geometry.computeVertexNormals();
    }
}
