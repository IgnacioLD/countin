/**
 * Main Application Entry Point
 */

import { CameraSelector } from './components/CameraSelector.js';
import cameraService from './services/camera.js';
import apiService from './services/api.js';
import { PersonTracker } from './tracker.js';
import { LineManager } from './line-manager.js';
import { CountingVisualization } from './visualization.js';
import QRCode from 'qrcode';
import Chart from 'chart.js/auto';
import './rfdetr-adapter.js';

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
        this.appMode = null; // 'standalone', 'hub', or 'camera'
        this.isRunning = false;
        this.animationId = null;
        this.counts = { total: 0, in: 0, out: 0 };
        this.currentSession = null;
        this.lineIdMap = new Map(); // Maps local line IDs to server line IDs
        this.onboardingStep = 1;
        this.isOnboarding = true;

        // Hub mode state
        this.hubSession = null;
        this.hubWebSocket = null;
        this.connectedCameras = new Map();
        this.hubOverviewChart = null;
        this.cameraDetailChart = null;
        this.chartData = {
            labels: [],
            datasets: []
        };

        // Camera mode state
        this.cameraStation = null;
        this.cameraWebSocket = null;
        this.hubId = null;
        this.cameraListenersSet = false;

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

        // Ensure setup-guide is hidden initially
        const setupGuide = document.getElementById('setup-guide');
        if (setupGuide) {
            setupGuide.classList.remove('active');
        }

        // Set up callbacks
        this.setupCallbacks();

        // Set up event listeners
        this.setupEventListeners();

        // Check for QR code pairing URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const pairingToken = urlParams.get('pair');

        if (pairingToken) {
            this.log('QR code detected, fetching pairing code...', 'info');
            try {
                // Fetch hub details using the token
                const response = await fetch(`${apiService.baseUrl}/hubs/token/${pairingToken}`);
                if (response.ok) {
                    const hub = await response.json();
                    // Switch to camera mode and auto-fill pairing code
                    this.selectMode('camera');

                    // Auto-fill the pairing code
                    setTimeout(() => {
                        const pairingInput = document.getElementById('pairing-code-input');
                        if (pairingInput) {
                            pairingInput.value = hub.pairing_code;
                            this.log('Pairing code auto-filled from QR code', 'success');
                        }
                    }, 500);

                    // Clear URL parameter
                    window.history.replaceState({}, document.title, window.location.pathname);
                    this.log('Initialization complete.', 'success');
                    return;
                } else {
                    this.log('Invalid or expired pairing link', 'error');
                }
            } catch (error) {
                console.error('Failed to fetch pairing info:', error);
                this.log('Failed to process pairing link', 'error');
            }
        }

        // Check for saved app mode
        const savedMode = localStorage.getItem('countin-app-mode');
        const savedCameraStationId = localStorage.getItem('countin-camera-station-id');
        const savedHubSessionId = localStorage.getItem('countin-hub-session-id');

        if (savedMode) {
            this.log(`Restoring previous mode: ${savedMode}`, 'info');
            const onboardingModal = document.getElementById('onboarding-modal');
            onboardingModal.classList.remove('active');
            this.isOnboarding = false;

            // Restore the mode
            if (savedMode === 'hub' && savedHubSessionId) {
                await this.restoreHubSession(savedHubSessionId);
            } else if (savedMode === 'camera' && savedCameraStationId) {
                await this.restoreCameraStation(savedCameraStationId);
            } else if (savedMode === 'standalone') {
                this.selectMode('standalone');
            }
        } else {
            // Show onboarding for new users
            this.setMode('setup');
        }

        this.log('Initialization complete.', 'success');
    }

    nextOnboardingStep() {
        const onboardingModal = document.getElementById('onboarding-modal');

        // Progress from step 1 (welcome) to step 2 (mode selection)
        if (this.onboardingStep === 1) {
            const step1 = onboardingModal.querySelector('[data-step="1"]');
            const step2 = onboardingModal.querySelector('[data-step="2"]');

            step1.classList.remove('active');
            step2.classList.add('active');
            this.onboardingStep = 2;
        }
    }

    selectMode(mode) {
        this.appMode = mode;
        localStorage.setItem('countin-app-mode', mode);
        this.log(`App mode selected: ${mode}`, 'info');

        const onboardingModal = document.getElementById('onboarding-modal');
        const mainContent = document.querySelector('.main-content');
        const visualizationPanel = document.querySelector('.visualization-panel');
        const logContainer = document.querySelector('.log-container');
        const hubView = document.getElementById('hub-view');
        const cameraView = document.getElementById('camera-view');

        // Update settings display
        const currentAppMode = document.getElementById('current-app-mode');
        if (currentAppMode) {
            currentAppMode.textContent = mode === 'standalone' ? 'Standalone' :
                                        mode === 'hub' ? 'Hub Dashboard' :
                                        'Camera Station';
        }

        if (mode === 'standalone') {
            // Hide onboarding, show camera selector
            onboardingModal.classList.remove('active');
            mainContent.style.display = 'grid';
            visualizationPanel.style.display = 'block';
            logContainer.style.display = 'block';
            hubView.style.display = 'none';
            cameraView.style.display = 'none';

            // Show mode indicator (Setup/Counting) for standalone mode
            const modeIndicator = document.querySelector('.mode-indicator');
            if (modeIndicator) modeIndicator.style.display = 'flex';

            // Show camera selector and continue to setup
            this.cameraSelector.show();

            // When camera is selected, show setup guide
            const originalOnCameraSelected = this.onCameraSelected.bind(this);
            this.onCameraSelected = (stream, deviceId) => {
                originalOnCameraSelected(stream, deviceId);

                // Show setup guide overlay
                const setupGuide = document.getElementById('setup-guide');
                setupGuide.classList.add('active');
                this.onboardingStep = 3;

                // Set up onboarding button listeners after guide is shown
                this.setupOnboardingButtons();
            };
        } else if (mode === 'hub') {
            // Hub dashboard mode
            onboardingModal.classList.remove('active');
            mainContent.style.display = 'none';
            visualizationPanel.style.display = 'none';
            logContainer.style.display = 'none';
            hubView.style.display = 'block';
            cameraView.style.display = 'none';

            // Hide mode indicator (Setup/Counting) - not applicable for hub
            const modeIndicator = document.querySelector('.mode-indicator');
            if (modeIndicator) modeIndicator.style.display = 'none';

            this.isOnboarding = false;
            this.initializeHubDashboard();
        } else if (mode === 'camera') {
            // Camera station mode
            onboardingModal.classList.remove('active');
            mainContent.style.display = 'none';
            visualizationPanel.style.display = 'none';
            logContainer.style.display = 'block';
            hubView.style.display = 'none';
            cameraView.style.display = 'block';

            // Hide mode indicator (Setup/Counting) - not applicable for camera
            const modeIndicator = document.querySelector('.mode-indicator');
            if (modeIndicator) modeIndicator.style.display = 'none';

            this.isOnboarding = false;
            this.initializeCameraStation();
        }
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

            // Update individual line counts in UI
            this.updateLineList();

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
        this.changeCameraBtn.addEventListener('click', () => {
            // Ensure video elements are visible before showing camera selector
            if (this.appMode === 'camera') {
                const mainContent = document.querySelector('.main-content');
                mainContent.style.display = 'grid';
            }
            this.cameraSelector.show();
        });

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

        // Logo click to go to home
        const logoLink = document.getElementById('logo-link');
        logoLink.addEventListener('click', () => {
            window.location.href = window.location.origin;
        });

        // Change mode button in settings
        const changeModeBtn = document.getElementById('change-mode-btn');
        if (changeModeBtn) {
            changeModeBtn.addEventListener('click', () => {
                // Close settings modal
                this.settingsModal.classList.remove('active');

                // Clear saved mode
                localStorage.removeItem('countin-app-mode');
                localStorage.removeItem('countin-hub-session-id');
                localStorage.removeItem('countin-hub-pairing-token');
                localStorage.removeItem('countin-camera-station-id');

                // Show onboarding to select mode again
                const onboardingModal = document.getElementById('onboarding-modal');
                const step1 = onboardingModal.querySelector('[data-step="1"]');
                const step2 = onboardingModal.querySelector('[data-step="2"]');

                // Reset to step 1
                if (step1) step1.classList.remove('active');
                if (step2) step2.classList.add('active');

                onboardingModal.classList.add('active');
                this.onboardingStep = 2;
                this.isOnboarding = true;

                this.log('Mode change initiated', 'info');
            });
        }

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

    async initializeHubDashboard() {
        this.log('Initializing Hub Dashboard...', 'info');

        try {
            // Create a new hub session
            const hubUrl = `${apiService.baseUrl}/hubs`;
            console.log('Creating hub at URL:', hubUrl);
            console.log('apiService.baseUrl:', apiService.baseUrl);
            console.log('apiService.baseURL:', apiService.baseURL);

            const response = await fetch(hubUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Hub ${new Date().toLocaleString()}` })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Hub creation failed:', errorText);
                throw new Error('Failed to create hub session');
            }

            this.hubSession = await response.json();

            // Store the actual code but don't display it yet
            this.hubPairingCodeActual = this.hubSession.pairing_code;
            this.hubPairingCodeVisible = false;

            // Initialize the code display (hidden by default)
            const codeElement = document.getElementById('hub-pairing-code');
            if (codeElement) {
                codeElement.textContent = '••••••';
                codeElement.classList.add('code-hidden');
            }

            // Save to localStorage (including pairing_token for QR code)
            localStorage.setItem('countin-hub-session-id', this.hubSession.id);
            localStorage.setItem('countin-hub-pairing-token', this.hubSession.pairing_token);

            this.log(`Hub created successfully with code: ${this.hubPairingCodeActual}`, 'success');

            // Connect to WebSocket for real-time updates
            this.connectHubWebSocket();

            // Set up event listeners for hub view
            this.setupHubEventListeners();

            // Start polling for camera updates
            this.pollHubStats();
        } catch (error) {
            this.log('Failed to initialize hub: ' + error.message, 'error');
        }
    }

    setupHubEventListeners() {
        const showQRBtn = document.getElementById('show-qr-btn');
        const qrModal = document.getElementById('qr-modal');
        const closeQRBtn = document.getElementById('close-qr-btn');
        const toggleCodeBtn = document.getElementById('toggle-code-btn');

        showQRBtn.addEventListener('click', () => this.showQRCode());

        closeQRBtn.addEventListener('click', () => {
            qrModal.classList.remove('active');
        });

        qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) {
                qrModal.classList.remove('active');
            }
        });

        toggleCodeBtn.addEventListener('click', () => this.togglePairingCode());

        // Camera detail modal
        const cameraDetailModal = document.getElementById('camera-detail-modal');
        const closeCameraDetailBtn = document.getElementById('close-camera-detail');

        closeCameraDetailBtn.addEventListener('click', () => {
            cameraDetailModal.classList.remove('active');
        });

        cameraDetailModal.addEventListener('click', (e) => {
            if (e.target === cameraDetailModal) {
                cameraDetailModal.classList.remove('active');
            }
        });

        // Initialize hub overview chart
        this.initializeHubChart();
    }

    initializeHubChart() {
        const canvas = document.getElementById('hub-overview-chart');
        if (!canvas) return;

        this.hubOverviewChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Total In',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Total Out',
                    data: [],
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    updateHubChart(totalIn, totalOut) {
        if (!this.hubOverviewChart) return;

        const now = new Date().toLocaleTimeString();

        // Add new data point
        this.hubOverviewChart.data.labels.push(now);
        this.hubOverviewChart.data.datasets[0].data.push(totalIn);
        this.hubOverviewChart.data.datasets[1].data.push(totalOut);

        // Keep only last 20 data points
        if (this.hubOverviewChart.data.labels.length > 20) {
            this.hubOverviewChart.data.labels.shift();
            this.hubOverviewChart.data.datasets[0].data.shift();
            this.hubOverviewChart.data.datasets[1].data.shift();
        }

        this.hubOverviewChart.update('none');
    }

    togglePairingCode() {
        const codeElement = document.getElementById('hub-pairing-code');
        const toggleBtn = document.getElementById('toggle-code-btn');

        console.log('Toggle pairing code clicked');
        console.log('Current code:', this.hubPairingCodeActual);
        console.log('Code element:', codeElement);
        console.log('Toggle button:', toggleBtn);

        if (!codeElement || !toggleBtn) {
            console.error('Code element or toggle button not found!');
            return;
        }

        if (!this.hubPairingCodeActual) {
            console.error('No pairing code available!');
            this.log('Pairing code not available', 'error');
            return;
        }

        this.hubPairingCodeVisible = !this.hubPairingCodeVisible;

        if (this.hubPairingCodeVisible) {
            codeElement.textContent = this.hubPairingCodeActual;
            codeElement.classList.remove('code-hidden');
            toggleBtn.textContent = '🙈';
            toggleBtn.title = 'Hide Code';
            this.log('Pairing code revealed', 'info');
        } else {
            codeElement.textContent = '••••••';
            codeElement.classList.add('code-hidden');
            toggleBtn.textContent = '👁️';
            toggleBtn.title = 'Show Code';
            this.log('Pairing code hidden', 'info');
        }
    }

    async showQRCode() {
        console.log('Show QR Code clicked');
        console.log('Hub session:', this.hubSession);

        if (!this.hubSession) {
            console.error('No hub session available!');
            this.log('No hub session available', 'error');
            return;
        }

        if (!this.hubSession.pairing_token) {
            console.error('No pairing token in hub session!');
            this.log('No pairing token available', 'error');
            return;
        }

        const qrModal = document.getElementById('qr-modal');
        const qrCodeDisplay = document.getElementById('qr-code-display');
        const qrPairingCode = document.getElementById('qr-pairing-code');

        if (!qrModal || !qrCodeDisplay || !qrPairingCode) {
            console.error('QR modal elements not found!');
            return;
        }

        // Clear previous QR code
        qrCodeDisplay.innerHTML = '';

        // Generate QR code with pairing token
        const pairingURL = `${window.location.origin}?pair=${this.hubSession.pairing_token}`;
        console.log('Generating QR for URL:', pairingURL);

        try {
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, pairingURL, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });

            qrCodeDisplay.appendChild(canvas);
            qrPairingCode.textContent = this.hubSession.pairing_code;

            qrModal.classList.add('active');
            this.log('QR code displayed', 'success');
        } catch (error) {
            console.error('QR code generation error:', error);
            this.log('Failed to generate QR code: ' + error.message, 'error');
        }
    }

    connectHubWebSocket() {
        if (!this.hubSession) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = (apiService.baseURL || window.location.origin).replace('http://', '').replace('https://', '');
        const wsURL = `${wsProtocol}//${wsHost}/api/v1/ws/hub/${this.hubSession.id}`;

        this.hubWebSocket = new WebSocket(wsURL);

        this.hubWebSocket.onopen = () => {
            this.log('Hub WebSocket connected', 'success');

            // Send ping every 30 seconds
            setInterval(() => {
                if (this.hubWebSocket.readyState === WebSocket.OPEN) {
                    this.hubWebSocket.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
        };

        this.hubWebSocket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'count_update') {
                this.handleCameraCountUpdate(message);
            }
        };

        this.hubWebSocket.onerror = (error) => {
            this.log('Hub WebSocket error', 'error');
            console.error('WebSocket error:', error);
        };

        this.hubWebSocket.onclose = () => {
            this.log('Hub WebSocket disconnected', 'warning');
        };
    }

    handleCameraCountUpdate(message) {
        const { camera_id, data } = message;
        this.connectedCameras.set(camera_id, data);

        // Update hub stats display
        this.updateHubStats();
    }

    async pollHubStats() {
        if (this.appMode !== 'hub' || !this.hubSession) return;

        try {
            const response = await fetch(`${apiService.baseUrl}/hubs/${this.hubSession.id}/stats`);
            const stats = await response.json();

            document.getElementById('hub-total-in').textContent = stats.total_in;
            document.getElementById('hub-total-out').textContent = stats.total_out;
            document.getElementById('hub-cameras-connected').textContent = stats.connected_cameras;

            // Update hub overview chart
            this.updateHubChart(stats.total_in, stats.total_out);

            // Get camera list
            const camerasResponse = await fetch(`${apiService.baseUrl}/cameras/hub/${this.hubSession.id}`);
            const cameras = await camerasResponse.json();

            this.updateCameraList(cameras);
        } catch (error) {
            console.error('Failed to poll hub stats:', error);
        }

        // Poll every 5 seconds
        setTimeout(() => this.pollHubStats(), 5000);
    }

    updateHubStats() {
        let totalIn = 0;
        let totalOut = 0;

        for (const [cameraId, data] of this.connectedCameras.entries()) {
            totalIn += data.total_in || 0;
            totalOut += data.total_out || 0;
        }

        document.getElementById('hub-total-in').textContent = totalIn;
        document.getElementById('hub-total-out').textContent = totalOut;
        document.getElementById('hub-cameras-connected').textContent = this.connectedCameras.size;
    }

    updateCameraList(cameras) {
        const cameraList = document.getElementById('hub-camera-list');

        if (cameras.length === 0) {
            cameraList.innerHTML = '<div class="empty-state">No cameras connected yet</div>';
            return;
        }

        cameraList.innerHTML = '';

        for (const camera of cameras) {
            const cameraCard = document.createElement('div');
            cameraCard.className = 'camera-card';
            cameraCard.dataset.cameraId = camera.id;

            const header = document.createElement('div');
            header.className = 'camera-card-header';

            const name = document.createElement('h4');
            name.textContent = camera.name;
            name.className = 'camera-name-display';
            header.appendChild(name);

            const status = document.createElement('div');
            status.className = `camera-status ${camera.is_connected ? 'online' : 'offline'}`;
            status.innerHTML = `<span class="status-dot"></span>${camera.is_connected ? 'Online' : 'Offline'}`;
            header.appendChild(status);

            cameraCard.appendChild(header);

            if (camera.location) {
                const location = document.createElement('div');
                location.className = 'camera-card-location';
                location.textContent = camera.location;
                cameraCard.appendChild(location);
            }

            const stats = document.createElement('div');
            stats.className = 'camera-card-stats';
            stats.innerHTML = `
                <div class="camera-stat">
                    <div class="camera-stat-value">${camera.total_in}</div>
                    <div class="camera-stat-label">In</div>
                </div>
                <div class="camera-stat">
                    <div class="camera-stat-value">${camera.total_out}</div>
                    <div class="camera-stat-label">Out</div>
                </div>
            `;
            cameraCard.appendChild(stats);

            // Add view details button
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-primary btn-small btn-full';
            viewBtn.textContent = 'View Details';
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                this.showCameraDetail(camera);
            };
            cameraCard.appendChild(viewBtn);

            // Add action buttons
            const actions = document.createElement('div');
            actions.className = 'camera-card-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary btn-small';
            editBtn.textContent = 'Edit Name';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                this.editCameraName(camera);
            };
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-small';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteCamera(camera);
            };
            actions.appendChild(deleteBtn);

            cameraCard.appendChild(actions);
            cameraList.appendChild(cameraCard);
        }
    }

    showCameraDetail(camera) {
        const modal = document.getElementById('camera-detail-modal');
        const nameEl = document.getElementById('camera-detail-name');
        const inEl = document.getElementById('camera-detail-in');
        const outEl = document.getElementById('camera-detail-out');
        const totalEl = document.getElementById('camera-detail-total');

        nameEl.textContent = camera.name;
        inEl.textContent = camera.total_in;
        outEl.textContent = camera.total_out;
        totalEl.textContent = camera.total_in + camera.total_out;

        // Initialize camera detail chart if not already created
        if (!this.cameraDetailChart) {
            const canvas = document.getElementById('camera-detail-chart');
            this.cameraDetailChart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: ['In', 'Out'],
                    datasets: [{
                        label: 'Counts',
                        data: [camera.total_in, camera.total_out],
                        backgroundColor: [
                            'rgba(76, 175, 80, 0.6)',
                            'rgba(33, 150, 243, 0.6)'
                        ],
                        borderColor: [
                            '#4CAF50',
                            '#2196F3'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        } else {
            // Update existing chart
            this.cameraDetailChart.data.datasets[0].data = [camera.total_in, camera.total_out];
            this.cameraDetailChart.update();
        }

        modal.classList.add('active');
    }

    async editCameraName(camera) {
        const newName = prompt('Enter new name for camera:', camera.name);
        if (!newName || newName === camera.name) return;

        try {
            const response = await fetch(`${apiService.baseUrl}/cameras/${camera.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            if (!response.ok) {
                throw new Error('Failed to update camera name');
            }

            this.log(`Camera renamed to "${newName}"`, 'success');

            // Refresh the camera list
            await this.pollHubStats();
        } catch (error) {
            console.error('Edit camera error:', error);
            this.log('Failed to update camera name: ' + error.message, 'error');
        }
    }

    async deleteCamera(camera) {
        if (!confirm(`Are you sure you want to delete "${camera.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${apiService.baseUrl}/cameras/${camera.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete camera');
            }

            this.log(`Camera "${camera.name}" deleted`, 'success');

            // Refresh the camera list
            await this.pollHubStats();
        } catch (error) {
            console.error('Delete camera error:', error);
            this.log('Failed to delete camera: ' + error.message, 'error');
        }
    }

    async initializeCameraStation() {
        this.log('Initializing Camera Station...', 'info');

        // Show camera view
        const cameraPairing = document.getElementById('camera-pairing');
        const cameraConnected = document.getElementById('camera-connected');

        cameraPairing.style.display = 'block';
        cameraConnected.style.display = 'none';

        // Set up pairing button
        const pairBtn = document.getElementById('pair-camera-btn');
        const pairingInput = document.getElementById('pairing-code-input');
        const cameraNameInput = document.getElementById('camera-name-input');
        const cameraLocationInput = document.getElementById('camera-location-input');

        // Check for pairing token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const pairingToken = urlParams.get('pair');

        if (pairingToken) {
            this.pairCameraWithToken(pairingToken, cameraNameInput.value, cameraLocationInput.value);
            return;
        }

        // Only set up event listeners once
        if (!this.cameraListenersSet) {
            pairBtn.addEventListener('click', async () => {
                const pairingCode = pairingInput.value.trim().toUpperCase();
                const cameraName = cameraNameInput.value.trim() || 'Camera';
                const cameraLocation = cameraLocationInput.value.trim();

                if (pairingCode.length !== 6) {
                    this.log('Pairing code must be 6 characters', 'error');
                    return;
                }

                await this.pairCamera(pairingCode, cameraName, cameraLocation);
            });

            // Set up disconnect button
            const disconnectBtn = document.getElementById('disconnect-camera-btn');
            disconnectBtn.addEventListener('click', () => this.disconnectCamera());

            // Sidebar toggle for camera view
            const toggleSidebarBtn = document.getElementById('toggle-camera-sidebar');
            const cameraView = document.getElementById('camera-view');
            toggleSidebarBtn.addEventListener('click', () => {
                cameraView.classList.toggle('sidebar-hidden');
                const icon = toggleSidebarBtn.querySelector('.toggle-icon');
                icon.textContent = cameraView.classList.contains('sidebar-hidden') ? '>' : '<';
                toggleSidebarBtn.title = cameraView.classList.contains('sidebar-hidden') ? 'Show sidebar' : 'Hide sidebar';
            });

            this.cameraListenersSet = true;
        }
    }

    async pairCamera(pairingCode, cameraName, cameraLocation) {
        try {
            const response = await fetch(`${apiService.baseURL}/api/v1/cameras/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pairing_code: pairingCode,
                    camera_name: cameraName,
                    camera_location: cameraLocation
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to pair camera');
            }

            this.cameraStation = await response.json();
            this.hubId = this.cameraStation.hub_session_id;

            // Save to localStorage
            localStorage.setItem('countin-camera-station-id', this.cameraStation.id);

            this.log('Camera paired successfully!', 'success');
            this.onCameraPaired();
        } catch (error) {
            this.log('Failed to pair camera: ' + error.message, 'error');
        }
    }

    async pairCameraWithToken(pairingToken, cameraName, cameraLocation) {
        try {
            const response = await fetch(`${apiService.baseURL}/api/v1/cameras/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pairing_token: pairingToken,
                    camera_name: cameraName || 'Camera',
                    camera_location: cameraLocation
                })
            });

            if (!response.ok) throw new Error('Failed to pair camera');

            this.cameraStation = await response.json();
            this.hubId = this.cameraStation.hub_session_id;

            this.log('Camera paired successfully!', 'success');
            this.onCameraPaired();
        } catch (error) {
            this.log('Failed to pair camera: ' + error.message, 'error');
        }
    }

    async onCameraPaired() {
        const cameraPairing = document.getElementById('camera-pairing');
        const cameraConnected = document.getElementById('camera-connected');
        const mainContent = document.querySelector('.main-content');

        cameraPairing.style.display = 'none';
        cameraConnected.style.display = 'block';

        // Update display
        document.getElementById('camera-display-name').textContent = this.cameraStation.name;
        document.getElementById('camera-display-location').textContent = this.cameraStation.location || '';

        // Connect WebSocket
        this.connectCameraWebSocket();

        // Show main content (video area) for camera selection
        mainContent.style.display = 'grid';

        // Start camera and counting
        this.cameraSelector.show();

        // Override onCameraSelected to start counting automatically
        const originalOnCameraSelected = this.onCameraSelected.bind(this);
        this.onCameraSelected = (stream, deviceId) => {
            originalOnCameraSelected(stream, deviceId);
            this.setMode('counting');
        };

        // Override line crossing callback to send to hub
        this.lineManager.onLineCrossed = async (event) => {
            const dirText = event.direction === 'in' ? 'entered' : 'exited';
            this.log(`Person ${event.personId} ${dirText} through ${event.lineName}`, event.direction);

            // Update local counts
            this.counts[event.direction]++;
            this.counts.total = this.counts.in + this.counts.out;

            // Update display
            document.getElementById('camera-total-in').textContent = this.counts.in;
            document.getElementById('camera-total-out').textContent = this.counts.out;

            // Send to hub via WebSocket
            if (this.cameraWebSocket && this.cameraWebSocket.readyState === WebSocket.OPEN) {
                this.cameraWebSocket.send(JSON.stringify({
                    type: 'count_update',
                    hub_id: this.hubId,
                    camera_id: this.cameraStation.id,
                    direction: event.direction,
                    counts: {
                        total_in: this.counts.in,
                        total_out: this.counts.out
                    }
                }));
            }

            // Also update via API
            try {
                await fetch(`${apiService.baseURL}/api/v1/cameras/${this.cameraStation.id}/increment?direction=${event.direction}`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Failed to increment camera count:', error);
            }
        };
    }

    connectCameraWebSocket() {
        if (!this.cameraStation) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = apiService.baseURL.replace('http://', '').replace('https://', '');
        const wsURL = `${wsProtocol}//${wsHost}/api/v1/ws/camera/${this.cameraStation.id}`;

        this.cameraWebSocket = new WebSocket(wsURL);

        this.cameraWebSocket.onopen = () => {
            this.log('Camera WebSocket connected', 'success');

            // Send heartbeat every 30 seconds
            setInterval(() => {
                if (this.cameraWebSocket.readyState === WebSocket.OPEN) {
                    this.cameraWebSocket.send(JSON.stringify({ type: 'heartbeat' }));
                }
            }, 30000);
        };

        this.cameraWebSocket.onerror = (error) => {
            this.log('Camera WebSocket error', 'error');
            console.error('WebSocket error:', error);
        };

        this.cameraWebSocket.onclose = () => {
            this.log('Camera WebSocket disconnected', 'warning');
        };
    }

    async disconnectCamera() {
        if (!this.cameraStation) return;

        try {
            await fetch(`${apiService.baseURL}/api/v1/cameras/${this.cameraStation.id}`, {
                method: 'DELETE'
            });

            if (this.cameraWebSocket) {
                this.cameraWebSocket.close();
            }

            this.log('Camera disconnected', 'info');

            // Reset state
            this.cameraStation = null;
            this.hubId = null;

            // Clear localStorage
            localStorage.removeItem('countin-camera-station-id');
            localStorage.removeItem('countin-app-mode');

            // Show pairing screen again
            document.getElementById('camera-pairing').style.display = 'block';
            document.getElementById('camera-connected').style.display = 'none';
        } catch (error) {
            this.log('Failed to disconnect camera: ' + error.message, 'error');
        }
    }

    async restoreHubSession(hubSessionId) {
        try {
            const response = await fetch(`${apiService.baseURL}/api/v1/hubs/${hubSessionId}`);
            if (!response.ok) throw new Error('Hub session not found');

            this.hubSession = await response.json();
            this.hubPairingCodeActual = this.hubSession.pairing_code;
            this.hubPairingCodeVisible = false;

            // Restore pairing_token from localStorage (needed for QR code)
            const savedPairingToken = localStorage.getItem('countin-hub-pairing-token');
            if (savedPairingToken) {
                this.hubSession.pairing_token = savedPairingToken;
            }

            // Show hub view
            const mainContent = document.querySelector('.main-content');
            const visualizationPanel = document.querySelector('.visualization-panel');
            const logContainer = document.querySelector('.log-container');
            const hubView = document.getElementById('hub-view');
            const cameraView = document.getElementById('camera-view');

            mainContent.style.display = 'none';
            visualizationPanel.style.display = 'none';
            logContainer.style.display = 'none';
            hubView.style.display = 'block';
            cameraView.style.display = 'none';

            // Connect WebSocket
            this.connectHubWebSocket();

            // Set up event listeners
            this.setupHubEventListeners();

            // Start polling
            this.pollHubStats();

            this.log('Hub session restored', 'success');
        } catch (error) {
            this.log('Failed to restore hub session: ' + error.message, 'error');
            localStorage.removeItem('countin-hub-session-id');
            localStorage.removeItem('countin-hub-pairing-token');
            localStorage.removeItem('countin-app-mode');
        }
    }

    async restoreCameraStation(cameraStationId) {
        try {
            const response = await fetch(`${apiService.baseURL}/api/v1/cameras/${cameraStationId}`);
            if (!response.ok) throw new Error('Camera station not found');

            this.cameraStation = await response.json();
            this.hubId = this.cameraStation.hub_session_id;

            // Show camera view
            const mainContent = document.querySelector('.main-content');
            const visualizationPanel = document.querySelector('.visualization-panel');
            const logContainer = document.querySelector('.log-container');
            const hubView = document.getElementById('hub-view');
            const cameraView = document.getElementById('camera-view');

            mainContent.style.display = 'none';
            visualizationPanel.style.display = 'none';
            logContainer.style.display = 'block';
            hubView.style.display = 'none';
            cameraView.style.display = 'block';

            // Initialize camera station
            this.initializeCameraStation();

            // Directly show connected state
            await this.onCameraPaired();

            this.log('Camera station restored', 'success');
        } catch (error) {
            this.log('Failed to restore camera station: ' + error.message, 'error');
            localStorage.removeItem('countin-camera-station-id');
            localStorage.removeItem('countin-app-mode');
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
