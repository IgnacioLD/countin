/**
 * app.js
 * Main application controller for the People Counting System
 */
class PeopleCounter {
    constructor() {
        // DOM elements
        this.video = document.getElementById('video');
        this.detectionCanvas = document.getElementById('detection-canvas');
        this.lineCanvas = document.getElementById('line-canvas');
        this.setupOverlay = document.getElementById('setup-overlay');

        // Mode buttons
        this.setupModeBtn = document.getElementById('setup-mode-btn');
        this.countingModeBtn = document.getElementById('counting-mode-btn');
        this.currentModeEl = document.getElementById('current-mode');

        // Line controls
        this.addLineBtn = document.getElementById('add-line-btn');
        this.clearLinesBtn = document.getElementById('clear-lines-btn');
        this.lineListEl = document.getElementById('line-list');

        // Stats elements
        this.totalCountEl = document.querySelector('#total-count .stat-value');
        this.inCountEl = document.querySelector('#in-count .stat-value');
        this.outCountEl = document.querySelector('#out-count .stat-value');

        // Server related
        this.sendDataBtn = document.getElementById('send-data-btn');
        this.syncIntervalSelect = document.getElementById('sync-interval');

        // Log container
        this.logEl = document.getElementById('log');

        // Initialize components
        this.lineManager = new LineManager(this.lineCanvas);
        this.tracker = new PersonTracker({
            confidenceThreshold: 0.4,
            maxDisappearedFrames: 15,
            historyLength: 10
        });
        this.visualization = new CountingVisualization('chart-container');

        // App state
        this.mode = 'setup'; // 'setup' or 'counting'
        this.isRunning = false;
        this.stream = null;
        this.animationId = null;
        this.counts = { total: 0, in: 0, out: 0 };
        this.serverSyncInterval = 60; // seconds
        this.lastSyncTime = Date.now();
        this.syncIntervalId = null;

        // Performance optimization
        this.frameCount = 0;
        this.detectionInterval = 2; // Process every n frames

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        this.log('Initializing people counter...');

        // Set up callbacks
        this.setupCallbacks();

        // Set up event listeners
        this.setupEventListeners();

        // Add test buttons for debugging
        this.addTestButtons();

        // Check for camera access
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            if (videoDevices.length === 0) {
                this.log('No camera detected. Please connect a camera to use this application.', 'error');
            } else {
                this.log(`Detected ${videoDevices.length} camera(s). Ready to start.`, 'info');
            }
        } catch (error) {
            this.log('Failed to enumerate video devices: ' + error.message, 'error');
        }

        // Default to setup mode
        this.setMode('setup');

        this.log('Initialization complete. Draw counting lines and switch to counting mode to begin.', 'success');
    }

    /**
     * Add test buttons for debugging
     */
    addTestButtons() {
        // Create a debug controls container with modern style
        const debugControls = document.createElement('div');
        debugControls.className = 'debug-controls';
        debugControls.style.marginTop = '20px';
        debugControls.style.padding = '20px';
        debugControls.style.background = 'linear-gradient(135deg, #f0f4f8, #d9e2ec)';
        debugControls.style.borderRadius = '12px';
        debugControls.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';

        // Add a title
        const debugTitle = document.createElement('h3');
        debugTitle.textContent = 'Debug Controls';
        debugControls.appendChild(debugTitle);

        // Create buttons container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '10px';
        debugControls.appendChild(buttonContainer);

        // Test Camera button
        const testCameraBtn = document.createElement('button');
        testCameraBtn.className = 'btn';
        testCameraBtn.textContent = 'Test Camera';
        testCameraBtn.addEventListener('click', () => this.initializeCamera());
        buttonContainer.appendChild(testCameraBtn);

        // Test Line button
        const testLineBtn = document.createElement('button');
        testLineBtn.className = 'btn';
        testLineBtn.textContent = 'Draw Test Line';
        testLineBtn.addEventListener('click', () => this.drawTestLine());
        buttonContainer.appendChild(testLineBtn);

        // Toggle Synthetic People button
        const syntheticBtn = document.createElement('button');
        syntheticBtn.className = 'btn';
        syntheticBtn.textContent = 'Toggle Synthetic People';
        syntheticBtn.addEventListener('click', () => {
            window.useSyntheticDetections = !window.useSyntheticDetections;
            this.log(`Synthetic people detection ${window.useSyntheticDetections ? 'enabled' : 'disabled'}`, 'info');
            syntheticBtn.style.backgroundColor = window.useSyntheticDetections ? '#28a745' : '#6c757d';
        });
        buttonContainer.appendChild(syntheticBtn);

        // Simulate Crossing button
        const simulateBtn = document.createElement('button');
        simulateBtn.className = 'btn';
        simulateBtn.textContent = 'Simulate Crossing';
        simulateBtn.addEventListener('click', () => this.simulateLineCrossing());
        buttonContainer.appendChild(simulateBtn);

        // Reset Counts button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn';
        resetBtn.textContent = 'Reset Counts';
        resetBtn.addEventListener('click', () => this.resetCounts());
        buttonContainer.appendChild(resetBtn);

        // Add to the controls panel
        const controlsPanel = document.querySelector('.controls-panel');
        controlsPanel.appendChild(debugControls);
    }

    /**
     * Set up callbacks between components
     */
    setupCallbacks() {
        // Line manager callbacks
        this.lineManager.onLineAdded = (line) => {
            this.log(`Added counting line: ${line.name}`, 'info');
            this.updateLineList();
        };

        this.lineManager.onLineRemoved = (line) => {
            this.log(`Removed line: ${line.name}`, 'info');
            this.updateLineList();
        };

        this.lineManager.onLinesCleared = () => {
            this.log('All counting lines cleared', 'info');
            this.updateLineList();
        };

        this.lineManager.onLineCrossed = (event) => {
            const dirText = event.direction === 'in' ? 'entered' : 'exited';
            this.log(`Person ${event.personId} ${dirText} through ${event.lineName}`, event.direction);

            // Update counts
            this.counts[event.direction]++;
            this.counts.total = this.counts.in + this.counts.out;
            this.updateCountDisplay();

            // Add to visualization
            this.visualization.addDataPoint(this.counts);
        };

        // Tracker callbacks
        this.tracker.onTrackUpdated = (trackId, track) => {
            // Check for line crossings if we have at least 2 positions in history
            if (track.history.length >= 2) {
                const currentPos = track.history[track.history.length - 1].centroid;
                const prevPos = track.history[track.history.length - 2].centroid;

                this.lineManager.checkLineCrossings(
                    { id: trackId },
                    prevPos,
                    currentPos
                );
            }
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Mode buttons
        this.setupModeBtn.addEventListener('click', () => this.setMode('setup'));
        this.countingModeBtn.addEventListener('click', () => this.setMode('counting'));

        // Line controls
        this.addLineBtn.addEventListener('click', () => this.toggleLineDrawing());
        this.clearLinesBtn.addEventListener('click', () => this.lineManager.clearLines());

        // Server sync
        this.sendDataBtn.addEventListener('click', () => this.sendDataToServer());
        this.syncIntervalSelect.addEventListener('change', () => {
            this.serverSyncInterval = parseInt(this.syncIntervalSelect.value, 10);

            if (this.isRunning) {
                this.restartServerSync();
            }

            this.log(`Server sync interval set to ${this.serverSyncInterval} seconds`, 'info');
        });

        // Set initial sync interval
        this.serverSyncInterval = parseInt(this.syncIntervalSelect.value, 10);
    }

    /**
     * Initialize camera
     */
    async initializeCamera() {
        try {
            this.log('Initializing camera...');

            // Stop any existing stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            // Get camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            // Set up the video
            this.video.srcObject = this.stream;
            this.video.style.display = 'block';

            // Set playsinline attribute for mobile devices
            this.video.setAttribute('playsinline', '');

            // Wait for video to load metadata
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(resolve).catch(e => {
                        this.log('Error playing video: ' + e.message, 'error');
                        resolve();
                    });
                };

                // If already loaded
                if (this.video.readyState >= 2) {
                    this.video.play().then(resolve).catch(e => {
                        this.log('Error playing video: ' + e.message, 'error');
                        resolve();
                    });
                }
            });

            // Make sure canvas dimensions match the video
            this.resizeCanvases();

            this.log('Camera initialized successfully', 'success');
        } catch (error) {
            this.log('Failed to initialize camera: ' + error.message, 'error');
        }
    }

    /**
     * Draw a test line for debugging
     */
    drawTestLine() {
        // Make sure canvas has dimensions
        if (this.lineCanvas.width === 0 || this.lineCanvas.height === 0) {
            const videoWidth = this.video.videoWidth || 640;
            const videoHeight = this.video.videoHeight || 480;

            this.lineCanvas.width = videoWidth;
            this.lineCanvas.height = videoHeight;
        }

        // Create a vertical line in the middle of the canvas
        const canvas = this.lineCanvas;
        const startX = canvas.width / 2;

        // Add a line
        this.lineManager.addLine({
            start: { x: startX, y: 0 },
            end: { x: startX, y: canvas.height },
            color: '#FF3333',
            name: 'Test Vertical Line'
        });

        this.log('Added test line for counting', 'info');
    }

    /**
     * Set the application mode
     * @param {string} mode - 'setup' or 'counting'
     */
    setMode(mode) {
        // Skip if we're already in this mode
        if (mode === this.mode) return;

        if (mode === 'setup') {
            // Switch to setup mode
            if (this.isRunning) {
                this.stopCounting();
            }
            
            // Hide setup overlay and enable drawing immediately
            this.setupOverlay.style.display = 'none';
            this.setupModeBtn.classList.add('active');
            this.countingModeBtn.classList.remove('active');
            this.currentModeEl.textContent = 'Setup';
            
            // Enable line manager for setup and inform the user
            this.lineManager.enableDrawing();
            this.log('Setup mode active: Click and drag on the canvas to draw counting areas. Use the pencil icon to cancel or restart drawing if needed.', 'info');
        } else if (mode === 'counting') {
            // Check if we have at least one line
            if (this.lineManager.getLines().length === 0) {
                this.log('Please draw at least one counting line before starting counting mode', 'error');
                return;
            }

            // Switch to counting mode
            this.setupOverlay.style.display = 'none';
            this.setupModeBtn.classList.remove('active');
            this.countingModeBtn.classList.add('active');
            this.currentModeEl.textContent = 'Counting';

            // Disable line drawing during counting
            this.lineManager.disableDrawing();

            // Start counting if not already running
            if (!this.isRunning) {
                this.startCounting();
            }

            this.log('Switched to counting mode', 'info');
        }

        this.mode = mode;
    }

    /**
     * Toggle line drawing mode
     */
    toggleLineDrawing() {
        const isDrawing = this.lineManager.isDrawingEnabled;

        if (isDrawing) {
            this.lineManager.disableDrawing();
            this.addLineBtn.textContent = 'Add Line';
            document.body.classList.remove('drawing-active');
        } else {
            this.lineManager.enableDrawing();
            this.addLineBtn.textContent = 'Cancel Drawing';
            document.body.classList.add('drawing-active');
        }
    }

    /**
     * Start the people counting process
     */
    async startCounting() {
        if (this.isRunning) return;

        try {
            this.log('Starting camera and detection...');

            // Initialize the camera if not already done
            if (!this.stream) {
                await this.initializeCamera();
            }

            // Initialize the tracking model if not already done
            if (!this.tracker.isModelLoaded) {
                this.log('Loading detection model...', 'info');
                await this.tracker.initialize();
                this.log('Detection model loaded', 'success');
            }

            // Start the processing loop
            this.isRunning = true;
            this.frameCount = 0;
            this.processFrame();

            // Start server sync interval
            this.startServerSync();

            this.log('People counting started successfully', 'success');
        } catch (error) {
            this.log(`Failed to start people counting: ${error.message}`, 'error');
        }
    }

    /**
     * Stop the people counting process
     */
    stopCounting() {
        if (!this.isRunning) return;

        // Stop the animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Stop the video stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.video.srcObject = null;
        }

        // Stop server sync
        this.stopServerSync();

        // Clear detection canvas
        const ctx = this.detectionCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        this.isRunning = false;
        this.log('People counting stopped', 'info');
    }

    /**
     * Process a video frame
     */
    async processFrame() {
        if (!this.isRunning) return;

        try {
            this.frameCount++;

            // Process only every nth frame for performance
            if (this.frameCount % this.detectionInterval === 0) {
                // Process the current frame
                await this.tracker.processFrame(this.video, this.detectionCanvas);
            }

            // Check for server sync
            const now = Date.now();
            if (now - this.lastSyncTime > this.serverSyncInterval * 1000) {
                this.sendDataToServer();
                this.lastSyncTime = now;
            }

            // Continue the loop
            this.animationId = requestAnimationFrame(() => this.processFrame());
        } catch (error) {
            console.error('Error processing frame:', error);
            this.log('Error during detection: ' + error.message, 'error');

            // Try to continue despite error
            this.animationId = requestAnimationFrame(() => this.processFrame());
        }
    }

    /**
     * Simulate a line crossing for testing
     */
    simulateLineCrossing() {
        // Get first line if exists
        const lines = this.lineManager.getLines();
        if (lines.length === 0) {
            this.log('No counting lines exist. Please add a line first.', 'warning');
            return;
        }

        const line = lines[0];

        // Create a mock person track
        const mockPersonId = `test-${Math.floor(Math.random() * 1000)}`;

        // Calculate points on either side of the line
        const dx = line.end.x - line.start.x;
        const dy = line.end.y - line.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        // Normalize direction vector
        const nx = dx / length;
        const ny = dy / length;

        // Calculate perpendicular vector
        const px = -ny;
        const py = nx;

        // Calculate points on either side of the line's midpoint
        const midX = (line.start.x + line.end.x) / 2;
        const midY = (line.start.y + line.end.y) / 2;

        // Points on opposite sides of the line
        const point1 = [midX + px * 50, midY + py * 50];
        const point2 = [midX - px * 50, midY - py * 50];

        // Determine crossing direction randomly
        const direction = Math.random() > 0.5 ? 'in' : 'out';

        // Order points based on direction to simulate
        const [prevPos, currentPos] = direction === 'in'
            ? [point1, point2]
            : [point2, point1];

        // Check line crossing
        this.lineManager.checkLineCrossings(
            { id: mockPersonId },
            prevPos,
            currentPos
        );

        this.log(`Simulated person ${mockPersonId} crossing through ${line.name}`, 'info');
    }

    /**
     * Resize canvases to match video dimensions
     */
    resizeCanvases() {
        const width = this.video.videoWidth || 640;
        const height = this.video.videoHeight || 480;

        if (width && height) {
            this.detectionCanvas.width = width;
            this.detectionCanvas.height = height;
            this.lineCanvas.width = width;
            this.lineCanvas.height = height;

            // Redraw the lines
            this.lineManager.resizeCanvas();

            console.log(`Canvases resized to ${width}x${height}`);
        }
    }

    /**
     * Update the line list display
     */
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

            // Get counts for this line
            const counts = lineCrossings[line.id] || { in: 0, out: 0 };

            // Create line name with color indicator
            const lineName = document.createElement('div');
            lineName.className = 'line-name';

            const colorIndicator = document.createElement('span');
            colorIndicator.className = 'line-color';
            colorIndicator.style.backgroundColor = line.color;
            lineName.appendChild(colorIndicator);

            lineName.appendChild(document.createTextNode(line.name));
            lineItem.appendChild(lineName);

            // Create counts display
            const countDisplay = document.createElement('div');
            countDisplay.className = 'line-counts';

            const inCount = document.createElement('span');
            inCount.className = 'line-count in';
            inCount.textContent = `In: ${counts.in}`;
            countDisplay.appendChild(inCount);

            const outCount = document.createElement('span');
            outCount.className = 'line-count out';
            outCount.textContent = `Out: ${counts.out}`;
            countDisplay.appendChild(outCount);

            lineItem.appendChild(countDisplay);

            // Create action buttons
            const actionBtns = document.createElement('div');
            actionBtns.className = 'line-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-icon edit-line';
            editBtn.dataset.id = line.id;
            editBtn.textContent = '✏️';
            editBtn.addEventListener('click', () => this.editLine(line.id));
            actionBtns.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon delete-line';
            deleteBtn.dataset.id = line.id;
            deleteBtn.textContent = '🗑️';
            deleteBtn.addEventListener('click', () => this.lineManager.removeLine(line.id));
            actionBtns.appendChild(deleteBtn);

            lineItem.appendChild(actionBtns);

            // Add to line list
            this.lineListEl.appendChild(lineItem);
        }
    }

    /**
     * Edit a line's name
     * @param {number} lineId - Line ID
     */
    editLine(lineId) {
        const line = this.lineManager.getLines().find(l => l.id === lineId);
        if (!line) return;

        const newName = prompt('Enter a new name for this line:', line.name);
        if (newName && newName.trim() !== '') {
            this.lineManager.renameLine(lineId, newName.trim());
            this.updateLineList();
            this.log(`Renamed line to "${newName.trim()}"`, 'info');
        }
    }

    /**
     * Update the count display
     */
    updateCountDisplay() {
        // Apply smooth transition for count updates
        this.totalCountEl.style.transition = "opacity 0.5s ease";
        this.inCountEl.style.transition = "opacity 0.5s ease";
        this.outCountEl.style.transition = "opacity 0.5s ease";
        this.totalCountEl.textContent = this.counts.total;
        this.inCountEl.textContent = this.counts.in;
        this.outCountEl.textContent = this.counts.out;
    }

    /**
     * Start server sync interval
     */
    startServerSync() {
        this.stopServerSync(); // Clear any existing interval

        this.syncIntervalId = setInterval(() => {
            this.sendDataToServer();
        }, this.serverSyncInterval * 1000);
    }

    /**
     * Stop server sync interval
     */
    stopServerSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    /**
     * Restart server sync with new interval
     */
    restartServerSync() {
        this.stopServerSync();
        this.startServerSync();
    }

    /**
     * Send count data to the server.
     * This function sends only the numerical counts for people detection using WebSocket if available,
     * otherwise falls back to an HTTP POST request.
     */
    /**
     * Initialize WebSocket connection for live data transmission.
     * Attempts to open a WebSocket connection to a predefined server URL.
     */
    initWebSocket() {
        const wsUrl = 'ws://localhost:8080'; // Update this URL as needed
        try {
            window.socket = new WebSocket(wsUrl);
            window.socket.onopen = () => {
                this.log('WebSocket connection established', 'success');
            };
            window.socket.onclose = () => {
                this.log('WebSocket connection closed', 'warning');
            };
            window.socket.onerror = (error) => {
                this.log('WebSocket error: ' + error.message, 'error');
            };
        } catch (error) {
            this.log('Failed to initialize WebSocket: ' + error.message, 'error');
        }
    }
    
    sendDataToServer() {
        this.log('Sending count data to server...', 'info');

        // Create data payload
        const data = {
            timestamp: new Date().toISOString(),
            counts: { ...this.counts },
            lineCounts: this.lineManager.getLineCrossings()
        };

        // Use WebSocket if available and connected
        if (window.socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.send(JSON.stringify(data));
            this.log('Data sent via WebSocket', 'success');
            this.lastSyncTime = Date.now();

            // Update status dot
            const statusDot = document.querySelector('.status-dot');
            const statusText = document.querySelector('.status-text');
            if (statusDot && statusText) {
                statusDot.classList.remove('offline');
                statusDot.classList.add('online');
                statusText.textContent = 'Online';
                setTimeout(() => {
                    statusDot.classList.remove('online');
                    statusDot.classList.add('offline');
                    statusText.textContent = 'Offline';
                }, 2000);
            }
        } else {
            // Fallback: Send data via HTTP POST
            fetch('/api/counts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                if (response.ok) {
                    this.log('Data sent via HTTP', 'success');
                    this.lastSyncTime = Date.now();
                } else {
                    this.log('HTTP data sending failed', 'error');
                }
            })
            .catch(err => {
                this.log('HTTP error: ' + err.message, 'error');
            });
        }

        console.log('Data payload for server:', data);
        return data;
    }

    /**
     * Log a message to the activity log
     * @param {string} message - Log message
     * @param {string} type - Log type ('info', 'success', 'warning', 'error', 'in', 'out')
     */
    log(message, type = 'info') {
        // Create log entry element
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.style.fontFamily = '"Helvetica Neue", sans-serif';

        // Add timestamp
        const time = new Date().toLocaleTimeString();

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = `[${time}]`;
        entry.appendChild(timeSpan);

        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = ` ${message}`;
        entry.appendChild(messageSpan);

        // Add to log container at the top
        this.logEl.insertBefore(entry, this.logEl.firstChild);

        // Limit the number of log entries
        while (this.logEl.children.length > 100) {
            this.logEl.removeChild(this.logEl.lastChild);
        }
        // Fade out log entry after 5 seconds for a cleaner interface
        setTimeout(() => {
            if (entry.parentElement) {
                entry.parentElement.removeChild(entry);
            }
        }, 5000);

        // Console log for debugging
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * Reset all counts
     */
    resetCounts() {
        this.counts = { total: 0, in: 0, out: 0 };
        this.lineManager.resetCounts();
        this.updateCountDisplay();
        this.updateLineList();
        this.visualization.clearData();
        this.log('All counts have been reset', 'info');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Start the application
    const app = new PeopleCounter();

    // Expose to window for debugging
    window.peopleCounter = app;
});
