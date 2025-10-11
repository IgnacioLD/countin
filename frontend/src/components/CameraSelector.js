/**
 * Camera Selector Component
 */

import cameraService from '../services/camera.js';

export class CameraSelector {
    constructor(modalId, onCameraSelected) {
        this.modal = document.getElementById(modalId);
        this.cameraList = document.getElementById('camera-list');
        this.confirmBtn = document.getElementById('camera-confirm-btn');
        this.onCameraSelected = onCameraSelected;
        this.selectedDeviceId = null;

        this.init();
    }

    async init() {
        this.confirmBtn.addEventListener('click', () => this.handleConfirm());

        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    async show() {
        this.modal.classList.add('active');
        await this.loadCameras();
    }

    hide() {
        this.modal.classList.remove('active');
    }

    async loadCameras() {
        try {
            const devices = await cameraService.getVideoDevices();

            if (devices.length === 0) {
                this.cameraList.innerHTML = '<p>No cameras detected</p>';
                return;
            }

            this.cameraList.innerHTML = '';

            devices.forEach((device, index) => {
                const item = document.createElement('div');
                item.className = 'camera-item';
                item.dataset.deviceId = device.deviceId;

                const label = device.label || `Camera ${index + 1}`;

                item.innerHTML = `
                    <div class="camera-item-label">${label}</div>
                `;

                item.addEventListener('click', () => this.selectCamera(device.deviceId));

                this.cameraList.appendChild(item);
            });

            // Auto-select first camera
            if (devices.length > 0 && !this.selectedDeviceId) {
                this.selectCamera(devices[0].deviceId);
            }
        } catch (error) {
            this.cameraList.innerHTML = `<p class="error">Failed to load cameras: ${error.message}</p>`;
        }
    }

    selectCamera(deviceId) {
        // Remove previous selection
        this.cameraList.querySelectorAll('.camera-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Select new camera
        const selectedItem = this.cameraList.querySelector(`[data-device-id="${deviceId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            this.selectedDeviceId = deviceId;
        }
    }

    async handleConfirm() {
        if (!this.selectedDeviceId) {
            alert('Please select a camera');
            return;
        }

        try {
            const stream = await cameraService.startCamera(this.selectedDeviceId);

            if (this.onCameraSelected) {
                this.onCameraSelected(stream, this.selectedDeviceId);
            }

            this.hide();
        } catch (error) {
            alert(`Failed to start camera: ${error.message}`);
        }
    }
}
