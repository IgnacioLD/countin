/**
 * Camera Service - Handles camera enumeration and selection
 */

export class CameraService {
    constructor() {
        this.devices = [];
        this.selectedDeviceId = null;
        this.stream = null;
    }

    /**
     * Verify the browser can access the camera API.
     * getUserMedia requires a secure context (HTTPS or localhost).
     */
    checkCameraSupport() {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            const host = window.location.hostname;
            const isLocalhost = host === 'localhost' || host === '127.0.0.1';
            const hint = isLocalhost
                ? 'Your browser blocked camera access. Check permissions or try Chrome/Edge.'
                : `Camera access requires HTTPS or localhost. You're on ${window.location.origin} — open http://localhost:3000 on this device, or serve CountIn over HTTPS.`;
            throw new Error(hint);
        }
    }

    /**
     * Get all available video input devices
     */
    async getVideoDevices() {
        try {
            this.checkCameraSupport();
            // Request initial permissions
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            tempStream.getTracks().forEach(track => track.stop());

            // Now enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'videoinput');

            return this.devices;
        } catch (error) {
            console.error('Failed to enumerate video devices:', error);
            throw error;
        }
    }

    /**
     * Start camera with specific device ID
     * Optimized for performance with 4K cameras - limits resolution to improve frame rate
     */
    async startCamera(deviceId, constraints = {}) {
        try {
            this.checkCameraSupport();
            // Stop any existing stream
            this.stopCamera();

            // Optimized constraints for performance
            // Lower resolution is sufficient for person detection and improves FPS significantly
            const videoConstraints = {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: constraints.width || { ideal: 640, max: 1280 },
                height: constraints.height || { ideal: 480, max: 720 },
                frameRate: constraints.frameRate || { ideal: 24, max: 30 },
                // Prefer environment-facing (rear) cameras
                facingMode: constraints.facingMode || 'environment',
            };

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false,
            });

            this.selectedDeviceId = deviceId;

            // Log actual video settings for debugging
            const videoTrack = this.stream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                console.log('Camera started with settings:', {
                    width: settings.width,
                    height: settings.height,
                    frameRate: settings.frameRate,
                    deviceId: settings.deviceId,
                });
            }

            return this.stream;
        } catch (error) {
            console.error('Failed to start camera:', error);
            throw error;
        }
    }

    /**
     * Stop current camera stream
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    /**
     * Get current stream
     */
    getCurrentStream() {
        return this.stream;
    }

    /**
     * Get selected device info
     */
    getSelectedDevice() {
        if (!this.selectedDeviceId) return null;
        return this.devices.find(d => d.deviceId === this.selectedDeviceId);
    }
}

export default new CameraService();
