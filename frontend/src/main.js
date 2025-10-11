/**
 * Main Application Entry Point
 */

import { CameraSelector } from './components/CameraSelector.js';
import cameraService from './services/camera.js';
import apiService from './services/api.js';
import { PersonTracker } from './tracker.js';
import { LineManager } from './line-manager.js';
import { CountingVisualization } from './visualization.js';

class CountInApp {
    constructor() {
        // DOM elements
        this.video = document.getElementById('video');
        this.detectionCanvas = document.getElementById('detection-canvas');
        this.lineCanvas = document.getElementById('line-canvas');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.changeCameraBtn = document.getElementById('change-camera-btn-modal');
        this.cameraInfo = document.getElementById('camera-info-modal');

        // Mode buttons
        this.setupModeBtn = document.getElementById('setup-mode-btn');
        this.countingModeBtn = document.getElementById('counting-mode-btn');
        this.currentModeEl = document.getElementById('current-mode');

        // Line controls
        this.clearLinesBtn = document.getElementById('clear-lines-btn');
        this.lineListEl = document.getElementById('line-list');
        this.lineModeBtn = document.getElementById('line-mode-btn');
        this.areaModeBtn = document.getElementById('area-mode-btn');

        // Stats elements
        this.totalCountEl = document.querySelector('#total-count .stat-value');
        this.inCountEl = document.querySelector('#in-count .stat-value');
        this.outCountEl = document.querySelector('#out-count .stat-value');

        // Session controls
        this.sessionNameInput = document.getElementById('session-name');
        this.saveSessionBtn = document.getElementById('save-session-btn');
        this.exportDataBtn = document.getElementById('export-data-btn');

        // Log container
        this.logEl = document.getElementById('log');

        // Loading modal
        this.loadingModal = document.getElementById('model-loading-modal');
        this.loadingStatus = document.getElementById('loading-status');
        this.loadingProgress = document.getElementById('loading-progress');

        // Initialize components
        this.lineManager = new LineManager(this.lineCanvas, this.video);
        this.tracker = new PersonTracker({
            confidenceThreshold: 0.4,
            maxDisappearedFrames: 15,
            historyLength: 10,
        });
        this.visualization = new CountingVisualization('chart-container');
        this.cameraSelector = new CameraSelector('camera-modal', (stream, deviceId) =>
            this.onCameraSelected(stream, deviceId)
        );

        // App state
        this.mode = 'setup';
        this.isRunning = false;
        this.animationId = null;
        this.counts = { total: 0, in: 0, out: 0 };
        this.currentSession = null;
        this.lineIdMap = new Map(); // Maps local line IDs to server line IDs
        this.onboardingStep = 1;
        this.isOnboarding = true;

        // Performance optimization
        this.frameCount = 0;
        // Process every 3rd frame for better performance with high-res cameras
        this.detectionInterval = 3;

        // Make app globally accessible for onclick handlers
        window.countInApp = this;

        this.init();
    }

    async init() {
        this.log('Initializing CountIn...');

        // Set up callbacks
        this.setupCallbacks();

        // Set up event listeners
        this.setupEventListeners();

        // Don't show camera selector yet - let onboarding handle it

        // Default to setup mode
        this.setMode('setup');

        this.log('Initialization complete.', 'success');
    }

    nextOnboardingStep() {
        const onboardingModal = document.getElementById('onboarding-modal');
        const setupGuide = document.getElementById('setup-guide');

        // Hide onboarding modal
        onboardingModal.classList.remove('active');

        // Show camera selector
        this.cameraSelector.show();

        // When camera is selected, show setup guide
        const originalOnCameraSelected = this.onCameraSelected.bind(this);
        this.onCameraSelected = (stream, deviceId) => {
            originalOnCameraSelected(stream, deviceId);

            // Show setup guide overlay
            setupGuide.classList.add('active');
            this.onboardingStep = 2;

            // Set up onboarding button listeners after guide is shown
            this.setupOnboardingButtons();
        };
    }

    setupOnboardingButtons() {
        const lineModeOnboard = document.getElementById('line-mode-onboard');
        const areaModeOnboard = document.getElementById('area-mode-onboard');

        console.log('Setting up onboarding buttons:', !!lineModeOnboard, !!areaModeOnboard);

        if (lineModeOnboard && areaModeOnboard) {
            lineModeOnboard.onclick = (e) => {
                console.log('Line mode clicked');
                e.preventDefault();
                e.stopPropagation();
                this.setDrawingMode('line');
                lineModeOnboard.classList.add('active');
                areaModeOnboard.classList.remove('active');
            };

            areaModeOnboard.onclick = (e) => {
                console.log('Area mode clicked');
                e.preventDefault();
                e.stopPropagation();
                this.setDrawingMode('area');
                areaModeOnboard.classList.add('active');
                lineModeOnboard.classList.remove('active');
            };

            console.log('Onboarding button handlers attached');
        } else {
            console.error('Onboarding buttons not found!');
        }
    }

    completeOnboarding() {
        const onboardingModal = document.getElementById('onboarding-modal');
        const setupGuide = document.getElementById('setup-guide');

        onboardingModal.classList.remove('active');
        setupGuide.classList.remove('active');
        this.isOnboarding = false;

        // Start counting if we have lines
        if (this.lineManager.getLines().length > 0) {
            this.setMode('counting');
        } else {
            this.log('No lines drawn. You can add them later from Settings.', 'info');
        }
    }

    skipOnboarding() {
        this.completeOnboarding();
    }

    setupCallbacks() {
        // Line manager callbacks
        this.lineManager.onLineAdded = async (line) => {
            this.log(`Added counting line: ${line.name}`, 'info');

            // Save line to backend if session is active
            if (this.currentSession && apiService.currentSession) {
                try {
                    const serverLine = await apiService.createLine({
                        name: line.name,
                        color: line.color,
                        orientation: line.orientation,
                        start_x: line.start.x,
                        start_y: line.start.y,
                        end_x: line.end.x,
                        end_y: line.end.y,
                    });
                    this.lineIdMap.set(line.id, serverLine.id);
                } catch (error) {
                    this.log('Failed to save line to server: ' + error.message, 'error');
                }
            }

            this.updateLineList();
        };

        this.lineManager.onLineRemoved = async (line) => {
            this.log(`Removed line: ${line.name}`, 'info');

            // Delete from backend
            const serverId = this.lineIdMap.get(line.id);
            if (serverId) {
                try {
                    await apiService.deleteLine(serverId);
                    this.lineIdMap.delete(line.id);
                } catch (error) {
                    this.log('Failed to delete line from server: ' + error.message, 'error');
                }
            }

            this.updateLineList();
        };

        this.lineManager.onLinesCleared = () => {
            this.log('All counting lines cleared', 'info');
            this.updateLineList();
        };

        this.lineManager.onLineCrossed = async (event) => {
            const dirText = event.direction === 'in' ? 'entered' : 'exited';
            this.log(`Person ${event.personId} ${dirText} through ${event.lineName}`, event.direction);

            // Update counts
            this.counts[event.direction]++;
            this.counts.total = this.counts.in + this.counts.out;
            this.updateCountDisplay();

            // Add to visualization
            this.visualization.addDataPoint(this.counts);

            // Save event to backend
            const serverLineId = this.lineIdMap.get(event.lineId);
            if (serverLineId && apiService.currentSession) {
                try {
                    await apiService.createEvent({
                        line_id: serverLineId,
                        person_id: event.personId.toString(),
                        direction: event.direction,
                        position_x: event.position ? event.position[0] : null,
                        position_y: event.position ? event.position[1] : null,
                    });
                } catch (error) {
                    this.log('Failed to save event to server: ' + error.message, 'error');
                }
            }
        };

        // Tracker callbacks
        this.tracker.onTrackUpdated = (trackId, track) => {
            if (track.history.length >= 2) {
                const currentPos = track.history[track.history.length - 1].centroid;
                const prevPos = track.history[track.history.length - 2].centroid;

                this.lineManager.checkLineCrossings({ id: trackId }, prevPos, currentPos);
            }
        };
    }

    setupEventListeners() {
        // Welcome tutorial
        const welcomeModal = document.getElementById('welcome-modal');
        const startTutorialBtn = document.getElementById('start-tutorial-btn');
        const dontShowCheckbox = document.getElementById('dont-show-tutorial');

        // Check if user has dismissed tutorial
        const tutorialDismissed = localStorage.getItem('countin-tutorial-dismissed');
        if (tutorialDismissed) {
            welcomeModal.classList.remove('active');
        }

        startTutorialBtn?.addEventListener('click', () => {
            if (dontShowCheckbox.checked) {
                localStorage.setItem('countin-tutorial-dismissed', 'true');
            }
            welcomeModal.classList.remove('active');
            // Auto-open camera selector
            setTimeout(() => this.cameraSelector.show(), 300);
        });

        // Mode buttons
        this.setupModeBtn.addEventListener('click', () => this.setMode('setup'));
        this.countingModeBtn.addEventListener('click', () => this.setMode('counting'));

        // Line controls
        this.clearLinesBtn.addEventListener('click', () => this.lineManager.clearLines());

        // Drawing mode buttons (in settings modal)
        this.lineModeBtn.addEventListener('click', () => this.setDrawingMode('line'));
        this.areaModeBtn.addEventListener('click', () => this.setDrawingMode('area'));

        // Settings modal
        this.settingsBtn.addEventListener('click', () => {
            this.settingsModal.classList.add('active');
        });

        this.closeSettingsBtn.addEventListener('click', () => {
            this.settingsModal.classList.remove('active');
        });

        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.settingsModal.classList.remove('active');
            }
        });

        // Camera controls
        this.changeCameraBtn.addEventListener('click', () => this.cameraSelector.show());

        // Mirror video toggle
        const mirrorCheckbox = document.getElementById('mirror-video-checkbox');
        mirrorCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.video.classList.add('mirrored');
            } else {
                this.video.classList.remove('mirrored');
            }
        });

        // Session controls
        this.saveSessionBtn.addEventListener('click', () => this.saveSession());
        this.exportDataBtn.addEventListener('click', () => this.exportData());

        // Window resize handler for responsive canvas
        window.addEventListener('resize', () => {
            this.resizeCanvases();
        });
    }

    async onCameraSelected(stream, deviceId) {
        this.video.srcObject = stream;
        this.video.setAttribute('playsinline', '');

        await new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play().then(resolve).catch((e) => {
                    this.log('Error playing video: ' + e.message, 'error');
                    resolve();
                });
            };
        });

        this.resizeCanvases();

        const device = cameraService.getSelectedDevice();
        if (device) {
            this.cameraInfo.textContent = `Using: ${device.label || 'Camera'}`;
            this.log(`Camera selected: ${device.label || 'Camera'}`, 'success');
        }

        // Ensure setup mode is active and drawing is enabled
        console.log('Setting mode to setup...');
        this.setMode('setup');
        console.log('Mode set, isDrawingEnabled:', this.lineManager.isDrawingEnabled);
        this.log('Ready to draw counting lines. Click and drag on the video.', 'info');
    }

    setMode(mode) {
        console.log('setMode called with:', mode, 'current mode:', this.mode);
        if (mode === this.mode) {
            console.log('Mode already set to', mode, '- forcing enable drawing anyway');
            if (mode === 'setup') {
                this.lineManager.enableDrawing();
            }
            return;
        }

        if (mode === 'setup') {
            if (this.isRunning) {
                this.stopCounting();
            }

            this.setupModeBtn.classList.add('active');
            this.countingModeBtn.classList.remove('active');
            this.currentModeEl.textContent = 'Setup';
            this.lineManager.enableDrawing();

            // Don't show setup guide if onboarding is complete
            if (!this.isOnboarding) {
                this.log('Setup mode active. Open Settings to change drawing tools.', 'info');
            }
        } else if (mode === 'counting') {
            if (this.lineManager.getLines().length === 0) {
                this.log('Please draw at least one counting line before starting counting mode', 'error');
                return;
            }

            this.setupModeBtn.classList.remove('active');
            this.countingModeBtn.classList.add('active');
            this.currentModeEl.textContent = 'Counting';
            this.lineManager.disableDrawing();

            if (!this.isRunning) {
                this.startCounting();
            }

            this.log('Switched to counting mode', 'info');
        }

        this.mode = mode;
    }

    setDrawingMode(mode) {
        // Update button active states
        if (mode === 'line') {
            this.lineModeBtn.classList.add('active');
            this.areaModeBtn.classList.remove('active');
        } else if (mode === 'area') {
            this.lineModeBtn.classList.remove('active');
            this.areaModeBtn.classList.add('active');
        }

        // Set the drawing mode on the line manager
        this.lineManager.setDrawingMode(mode);
        this.log(`Drawing mode set to: ${mode}`, 'info');
    }

    toggleLineDrawing() {
        const isDrawing = this.lineManager.isDrawingEnabled;

        if (isDrawing) {
            this.lineManager.disableDrawing();
            this.addLineBtn.textContent = 'Add Line';
        } else {
            this.lineManager.enableDrawing();
            this.addLineBtn.textContent = 'Cancel Drawing';
        }
    }

    async startCounting() {
        if (this.isRunning) return;

        this.log('Starting detection...');

        // Initialize the tracking model FIRST
        try {
            if (!this.tracker.isModelLoaded) {
                // Show loading modal
                this.loadingModal.classList.add('active');
                this.loadingStatus.textContent = 'Downloading AI model...';
                this.loadingProgress.style.width = '30%';

                this.log('Loading AI detection model (this may take a minute)...', 'info');
                console.log('Starting tracker initialization...');

                // Simulate progress updates
                setTimeout(() => {
                    this.loadingStatus.textContent = 'Initializing TensorFlow.js...';
                    this.loadingProgress.style.width = '60%';
                }, 500);

                await this.tracker.initialize();

                this.loadingStatus.textContent = 'Model loaded successfully!';
                this.loadingProgress.style.width = '100%';

                // Hide loading modal after a brief delay
                setTimeout(() => {
                    this.loadingModal.classList.remove('active');
                }, 500);

                console.log('Tracker initialized, model loaded:', this.tracker.isModelLoaded);
                this.log('AI detection model loaded successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to load AI model:', error);
            this.loadingStatus.textContent = 'Model failed to load, using test mode';
            this.loadingProgress.style.width = '100%';

            setTimeout(() => {
                this.loadingModal.classList.remove('active');
            }, 1000);

            this.log('AI model failed to load, using synthetic detections for testing', 'warning');
            window.rfdetrAdapter.enableSyntheticDetections();
        }

        // Try to create session (but don't let it block detection)
        try {
            if (!this.currentSession) {
                const sessionName = this.sessionNameInput.value || `Session ${new Date().toLocaleString()}`;
                this.currentSession = await apiService.createSession(sessionName);
                this.log(`Session created: ${sessionName}`, 'success');
            }
        } catch (error) {
            console.warn('Backend API not available:', error);
            this.log('Running in local mode (backend not connected)', 'warning');
        }

        // Start the processing loop regardless of backend status
        this.isRunning = true;
        this.frameCount = 0;
        this.processFrame();

        this.log('People counting started - AI is now detecting people', 'success');
    }

    stopCounting() {
        if (!this.isRunning) return;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        const ctx = this.detectionCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        this.isRunning = false;
        this.log('People counting stopped', 'info');
    }

    async processFrame() {
        if (!this.isRunning) return;

        try {
            this.frameCount++;

            if (this.frameCount % this.detectionInterval === 0) {
                const result = await this.tracker.processFrame(this.video, this.detectionCanvas);

                // Log detection info every 30 frames (about once per second)
                if (this.frameCount % 30 === 0 && result) {
                    console.log('Detection result:', result);
                }
            }

            this.animationId = requestAnimationFrame(() => this.processFrame());
        } catch (error) {
            console.error('Error processing frame:', error);
            this.animationId = requestAnimationFrame(() => this.processFrame());
        }
    }

    resizeCanvases() {
        // Use the displayed size of the video element for high-quality rendering
        const rect = this.video.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        if (width && height) {
            // Set canvas internal resolution to match display size for crisp rendering
            this.detectionCanvas.width = width;
            this.detectionCanvas.height = height;
            this.lineCanvas.width = width;
            this.lineCanvas.height = height;
            this.lineManager.resizeCanvas();

            console.log('Canvases resized to:', width, 'x', height);
        }
    }

    updateLineList() {
        const lines = this.lineManager.getLines();
        const lineCrossings = this.lineManager.getLineCrossings();

        if (lines.length === 0) {
            this.lineListEl.innerHTML = '<div class="empty-state">No lines added yet</div>';
            return;
        }

        this.lineListEl.innerHTML = '';

        for (const line of lines) {
            const lineItem = document.createElement('div');
            lineItem.className = 'line-item';

            const counts = lineCrossings[line.id] || { in: 0, out: 0 };

            // Top row: color picker, name, delete
            const topRow = document.createElement('div');
            topRow.className = 'line-item-top';

            // Color picker
            const colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.value = line.color;
            colorPicker.className = 'line-color-picker';
            colorPicker.title = 'Change line color';
            colorPicker.addEventListener('change', (e) => {
                line.color = e.target.value;
                this.lineManager.redrawLines();
                this.log(`Changed line color to: ${e.target.value}`, 'info');
            });
            topRow.appendChild(colorPicker);

            // Editable line name input
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = line.name;
            nameInput.className = 'line-name-input';
            nameInput.addEventListener('change', (e) => {
                this.lineManager.renameLine(line.id, e.target.value);
                this.log(`Renamed line to: ${e.target.value}`, 'info');
            });
            topRow.appendChild(nameInput);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'line-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete line';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete line "${line.name}"?`)) {
                    this.lineManager.removeLine(line.id);
                    this.updateLineList();
                }
            });
            topRow.appendChild(deleteBtn);

            lineItem.appendChild(topRow);

            // Bottom row: counts and direction toggle
            const bottomRow = document.createElement('div');
            bottomRow.className = 'line-item-bottom';

            const countDisplay = document.createElement('div');
            countDisplay.className = 'line-counts';

            const inCount = document.createElement('span');
            inCount.className = 'line-count in';
            inCount.textContent = `↓${counts.in}`;
            inCount.title = `In: ${counts.in}`;
            countDisplay.appendChild(inCount);

            const outCount = document.createElement('span');
            outCount.className = 'line-count out';
            outCount.textContent = `↑${counts.out}`;
            outCount.title = `Out: ${counts.out}`;
            countDisplay.appendChild(outCount);

            bottomRow.appendChild(countDisplay);

            // Direction toggle button
            const directionBtn = document.createElement('button');
            directionBtn.className = 'line-direction-btn';
            directionBtn.innerHTML = '⇄';
            directionBtn.title = 'Swap in/out direction';
            directionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Swap the line direction by flipping start and end
                const temp = { ...line.start };
                line.start = { ...line.end };
                line.end = temp;
                this.lineManager.redrawLines();
                this.log(`Reversed direction for line: ${line.name}`, 'info');
            });
            bottomRow.appendChild(directionBtn);

            lineItem.appendChild(bottomRow);

            this.lineListEl.appendChild(lineItem);
        }
    }

    updateCountDisplay() {
        this.totalCountEl.textContent = this.counts.total;
        this.inCountEl.textContent = this.counts.in;
        this.outCountEl.textContent = this.counts.out;
    }

    async saveSession() {
        if (!this.currentSession) {
            this.log('No active session to save', 'warning');
            return;
        }

        try {
            // End the session
            await apiService.endSession(this.currentSession.id);
            this.log('Session saved successfully', 'success');

            // Reset for new session
            this.currentSession = null;
            this.sessionNameInput.value = '';
        } catch (error) {
            this.log('Failed to save session: ' + error.message, 'error');
        }
    }

    async exportData() {
        if (!this.currentSession) {
            this.log('No active session to export', 'warning');
            return;
        }

        try {
            const stats = await apiService.getSessionStats(this.currentSession.id);
            const events = await apiService.getSessionEvents(this.currentSession.id);

            const data = {
                session: this.currentSession,
                stats,
                events,
                exportedAt: new Date().toISOString(),
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `countin-session-${this.currentSession.id}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.log('Data exported successfully', 'success');
        } catch (error) {
            this.log('Failed to export data: ' + error.message, 'error');
        }
    }

    log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;

        const time = new Date().toLocaleTimeString();
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = `[${time}]`;
        entry.appendChild(timeSpan);

        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = ` ${message}`;
        entry.appendChild(messageSpan);

        this.logEl.insertBefore(entry, this.logEl.firstChild);

        while (this.logEl.children.length > 100) {
            this.logEl.removeChild(this.logEl.lastChild);
        }

        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.countInApp = new CountInApp();
    });
} else {
    window.countInApp = new CountInApp();
}
