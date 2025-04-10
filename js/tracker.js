/**
 * Person Tracker
 *
 * Handles tracking of people across frames and detection of line crossings.
 * Uses TensorFlow.js for person detection.
 */
class PersonTracker {
    constructor(options = {}) {
        // Configuration
        this.confidenceThreshold = options.confidenceThreshold || 0.4;
        this.maxDisappearedFrames = options.maxDisappearedFrames || 15;
        this.historyLength = options.historyLength || 10;

        // Detection model
        this.model = null;
        this.isModelLoaded = false;

        // Tracking state
        this.nextTrackId = 1;
        this.tracks = {};
        this.disappeared = {};

        // Callbacks
        this.onTrackUpdated = options.onTrackUpdated || null;

        // Debug mode
        this.debugMode = options.debugMode || false;
    }

    /**
     * Initialize the tracker and load the detection model
     */
    async initialize() {
        if (this.isModelLoaded) return;

        try {
            // Load the COCO-SSD model
            this.model = await window.rfdetrAdapter.loadModel();
            this.isModelLoaded = true;

            console.log('Person tracking model loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load tracking model:', error);
            throw error;
        }
    }

    /**
     * Process a video frame to detect and track people
     * @param {HTMLVideoElement} videoElement - Video element to process
     * @param {HTMLCanvasElement} canvas - Optional canvas for visualization
     * @returns {Object} Detection and tracking results
     */
    async processFrame(videoElement, canvas = null) {
        if (!this.isModelLoaded && !window.useSyntheticDetections) {
            throw new Error('Tracker model not initialized. Call initialize() first.');
        }

        // Get detections
        let detections = [];

        if (window.useSyntheticDetections) {
            // Generate synthetic detections for testing
            detections = this.generateSyntheticDetections(canvas);
        } else {
            // Get real detections from the model
            detections = await this.detectPeople(videoElement);
        }

        // Update tracks with new detections
        const trackingResults = this.updateTracks(detections);

        // Draw debug visualization if canvas is provided
        if (canvas) {
            this.drawDetections(canvas, detections, trackingResults.tracks);
        }

        return {
            detections,
            tracks: trackingResults.tracks,
            updated: trackingResults.updated,
            disappeared: trackingResults.disappeared
        };
    }

    /**
     * Detect people in a video frame using the model
     * @param {HTMLVideoElement} videoElement - Video element to process
     * @returns {Array} Array of person detections
     */
    async detectPeople(videoElement) {
        try {
            // Run detection
            const predictions = await window.rfdetrAdapter.detectPeople(videoElement);

            // Filter predictions to only include people with confidence above threshold
            return predictions.filter(pred =>
                pred.class === 'person' &&
                pred.score >= this.confidenceThreshold
            );
        } catch (error) {
            console.error('Detection error:', error);
            return [];
        }
    }

    /**
     * Generate synthetic detections for testing
     * @param {HTMLCanvasElement} canvas - Canvas to get dimensions from
     * @returns {Array} Array of synthetic person detections
     */
    generateSyntheticDetections(canvas) {
        const width = canvas ? canvas.width : 640;
        const height = canvas ? canvas.height : 480;

        // Don't generate detections every frame to make it more realistic
        if (Math.random() > 0.3) {
            // Just return existing detections with minor position adjustments
            const existingTracks = Object.values(this.tracks);
            if (existingTracks.length === 0) {
                // If no existing tracks, generate a new one
                return this.generateNewSyntheticDetections(width, height, 1);
            }

            return existingTracks.map(track => {
                const lastPos = track.history[track.history.length - 1];
                if (!lastPos) return null;

                // Get movement direction based on the track's property
                let xMove = (Math.random() - 0.5) * 5;
                let yMove = (Math.random() - 0.5) * 5;

                // If this track is supposed to cross a line, make it move more deterministically
                if (track.isMovingAcross) {
                    // For example, move consistently left to right across the center
                    const centerX = width / 2;
                    const distanceFromCenter = lastPos.bbox[0] - centerX;

                    // Make movement more deterministic - move toward the center then past it
                    if (Math.abs(distanceFromCenter) < 50) {
                        // Close to center line, move faster to cross it
                        xMove = distanceFromCenter < 0 ? 15 : -15;
                    } else if (distanceFromCenter < 0) {
                        // Left of center, move right
                        xMove = 8;
                    } else {
                        // Right of center, move left
                        xMove = -8;
                    }

                    // Small random movement in Y direction
                    yMove = (Math.random() - 0.5) * 3;
                }

                // Calculate new position, keeping within bounds
                const newX = Math.max(0, Math.min(width - lastPos.bbox[2], lastPos.bbox[0] + xMove));
                const newY = Math.max(0, Math.min(height - lastPos.bbox[3], lastPos.bbox[1] + yMove));

                return {
                    class: 'person',
                    score: 0.9,
                    bbox: [
                        newX,
                        newY,
                        lastPos.bbox[2],
                        lastPos.bbox[3]
                    ],
                    isMovingAcross: track.isMovingAcross
                };
            }).filter(Boolean);
        }

        // Generate new synthetic people occasionally
        return this.generateNewSyntheticDetections(width, height, Math.floor(Math.random() * 2) + 1);
    }

    /**
     * Generate brand new synthetic detections
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} count - Number of detections to generate
     * @returns {Array} Synthetic detections
     */
    generateNewSyntheticDetections(width, height, count) {
        const detections = [];
        const centerX = width / 2;

        for (let i = 0; i < count; i++) {
            // Determine if person should cross the vertical line in the middle
            const shouldCross = Math.random() > 0.5;

            // Position - if crossing, start on one side of the center
            let x;
            if (shouldCross) {
                // Start on left or right side, but not too close to the edge
                x = Math.random() > 0.5 ?
                    centerX - 200 - Math.random() * 100 : // Left side
                    centerX + 100 + Math.random() * 100;  // Right side
            } else {
                // Random position but avoid center
                x = Math.random() * (width - 200);
                if (Math.abs(x - centerX) < 100) {
                    x = x < centerX ? x - 100 : x + 100;
                }
            }

            // Generate random size for the bounding box
            const boxWidth = Math.random() * 50 + 50;   // 50-100px
            const boxHeight = Math.random() * 100 + 100; // 100-200px
            const y = Math.random() * (height - boxHeight - 50) + 50;

            detections.push({
                class: 'person',
                score: 0.8 + Math.random() * 0.2, // 0.8-1.0 confidence
                bbox: [
                    Math.max(0, Math.min(width - boxWidth, x)),
                    y,
                    boxWidth,
                    boxHeight
                ],
                isMovingAcross: shouldCross
            });
        }

        return detections;
    }

    /**
     * Update tracks with new detections
     * @param {Array} detections - Array of person detections
     * @returns {Object} Updated tracking information
     */
    updateTracks(detections) {
        // Initialize result arrays
        const updated = [];
        const currentTracks = {};

        // If no detections, mark all tracks as disappeared
        if (detections.length === 0) {
            return this.handleDisappearances(detections, {}, updated);
        }

        // If no existing tracks, create new tracks for each detection
        if (Object.keys(this.tracks).length === 0) {
            detections.forEach(detection => {
                const trackId = this.nextTrackId++;
                const newTrack = this.initializeTrack(trackId, detection);
                currentTracks[trackId] = newTrack;
                updated.push(trackId);
            });

            this.tracks = currentTracks;
            return { tracks: this.tracks, updated, disappeared: [] };
        }

        // Calculate IoU between existing tracks and new detections
        const iouMatrix = this.calculateIoUMatrix(detections);

        // Match detections with existing tracks
        const { matched, unmatched } = this.matchDetectionsToTracks(iouMatrix, detections);

        // Update matched tracks
        for (const { trackId, detectionIdx } of matched) {
            const detection = detections[detectionIdx];
            const track = this.tracks[trackId];

            // Update track with new detection
            this.updateTrack(trackId, track, detection);

            // Keep track of updated tracks
            currentTracks[trackId] = track;
            updated.push(trackId);

            // Reset disappeared counter
            this.disappeared[trackId] = 0;

            // Trigger callback if exists
            if (this.onTrackUpdated) {
                this.onTrackUpdated(trackId, track);
            }
        }

        // Create new tracks for unmatched detections
        for (const detectionIdx of unmatched) {
            const detection = detections[detectionIdx];
            const trackId = this.nextTrackId++;

            // Create new track
            const newTrack = this.initializeTrack(trackId, detection);
            currentTracks[trackId] = newTrack;
            updated.push(trackId);

            // Initialize disappeared counter
            this.disappeared[trackId] = 0;
        }

        // Handle disappeared tracks
        return this.handleDisappearances(detections, currentTracks, updated);
    }

    /**
     * Initialize a new track from a detection
     * @param {number} trackId - ID for the new track
     * @param {Object} detection - Person detection
     * @returns {Object} New track object
     */
    initializeTrack(trackId, detection) {
        // Create object to store detection history
        const [x, y, width, height] = detection.bbox;

        const centroid = [
            x + width / 2,
            y + height / 2
        ];

        return {
            id: trackId,
            bbox: detection.bbox,
            lastSeen: Date.now(),
            history: [{
                timestamp: Date.now(),
                bbox: detection.bbox,
                centroid,
                score: detection.score
            }],
            // For synthetic data movement direction
            isMovingAcross: detection.isMovingAcross
        };
    }

    /**
     * Update an existing track with a new detection
     * @param {number} trackId - Track ID
     * @param {Object} track - Track object
     * @param {Object} detection - New detection
     */
    updateTrack(trackId, track, detection) {
        const [x, y, width, height] = detection.bbox;

        const centroid = [
            x + width / 2,
            y + height / 2
        ];

        // Update last seen time
        track.lastSeen = Date.now();

        // Update bounding box
        track.bbox = detection.bbox;

        // Add to history (keeping limited history)
        track.history.push({
            timestamp: Date.now(),
            bbox: detection.bbox,
            centroid,
            score: detection.score
        });

        // Limit history length
        if (track.history.length > this.historyLength) {
            track.history.shift();
        }

        // For synthetic data - keep movement flag
        if (detection.isMovingAcross !== undefined) {
            track.isMovingAcross = detection.isMovingAcross;
        }
    }

    /**
     * Calculate IoU (Intersection over Union) matrix between detections and tracks
     * @param {Array} detections - Array of new detections
     * @returns {Array} Matrix of IoU values
     */
    calculateIoUMatrix(detections) {
        const iouMatrix = [];

        // For each track
        Object.values(this.tracks).forEach(track => {
            const trackIoUs = [];

            // Calculate IoU with each detection
            detections.forEach(detection => {
                const iou = this.calculateIoU(track.bbox, detection.bbox);
                trackIoUs.push(iou);
            });

            iouMatrix.push(trackIoUs);
        });

        return iouMatrix;
    }

    /**
     * Calculate IoU (Intersection over Union) between two bounding boxes
     * @param {Array} bbox1 - First bounding box [x, y, width, height]
     * @param {Array} bbox2 - Second bounding box [x, y, width, height]
     * @returns {number} IoU value between 0 and 1
     */
    calculateIoU(bbox1, bbox2) {
        // Convert [x, y, width, height] to [x1, y1, x2, y2]
        const box1 = {
            x1: bbox1[0],
            y1: bbox1[1],
            x2: bbox1[0] + bbox1[2],
            y2: bbox1[1] + bbox1[3]
        };

        const box2 = {
            x1: bbox2[0],
            y1: bbox2[1],
            x2: bbox2[0] + bbox2[2],
            y2: bbox2[1] + bbox2[3]
        };

        // Calculate intersection area
        const xOverlap = Math.max(0, Math.min(box1.x2, box2.x2) - Math.max(box1.x1, box2.x1));
        const yOverlap = Math.max(0, Math.min(box1.y2, box2.y2) - Math.max(box1.y1, box2.y1));
        const intersectionArea = xOverlap * yOverlap;

        // Calculate union area
        const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
        const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
        const unionArea = box1Area + box2Area - intersectionArea;

        // Return IoU
        return unionArea > 0 ? intersectionArea / unionArea : 0;
    }

    /**
     * Match detections to existing tracks using IoU matrix
     * @param {Array} iouMatrix - Matrix of IoU values
     * @param {Array} detections - Array of new detections
     * @returns {Object} Matched and unmatched detections
     */
    matchDetectionsToTracks(iouMatrix, detections) {
        const matched = [];
        const unmatched = [];

        // Minimum IoU to consider a match
        const minIoU = 0.3;

        // If no tracks or no detections, all detections are unmatched
        if (iouMatrix.length === 0) {
            for (let i = 0; i < detections.length; i++) {
                unmatched.push(i);
            }
            return { matched, unmatched };
        }

        // Find best matches using a greedy algorithm
        const trackIds = Object.keys(this.tracks).map(Number);
        const matchedDetections = new Set();

        // For each track, find best matching detection
        for (let i = 0; i < iouMatrix.length; i++) {
            const trackId = trackIds[i];
            const trackIoUs = iouMatrix[i];

            // Find detection with highest IoU for this track
            let maxIoU = -1;
            let maxIdx = -1;

            for (let j = 0; j < trackIoUs.length; j++) {
                if (!matchedDetections.has(j) && trackIoUs[j] > maxIoU) {
                    maxIoU = trackIoUs[j];
                    maxIdx = j;
                }
            }

            // If we found a match above the threshold
            if (maxIoU >= minIoU) {
                matched.push({ trackId, detectionIdx: maxIdx });
                matchedDetections.add(maxIdx);
            }
        }

        // Add unmatched detections
        for (let i = 0; i < detections.length; i++) {
            if (!matchedDetections.has(i)) {
                unmatched.push(i);
            }
        }

        return { matched, unmatched };
    }

    /**
     * Handle track disappearances and update tracking state
     * @param {Array} detections - Current detections
     * @param {Object} currentTracks - Current tracks
     * @param {Array} updated - IDs of updated tracks
     * @returns {Object} Updated tracking information
     */
    handleDisappearances(detections, currentTracks, updated) {
        const disappeared = [];

        // Check for disappeared tracks
        for (const trackId in this.tracks) {
            if (!currentTracks[trackId]) {
                // Track not updated in this frame
                this.disappeared[trackId] = (this.disappeared[trackId] || 0) + 1;

                // If disappeared for too many frames, don't keep track
                if (this.disappeared[trackId] > this.maxDisappearedFrames) {
                    disappeared.push(parseInt(trackId));
                } else {
                    // Keep track with latest known position
                    currentTracks[trackId] = this.tracks[trackId];
                }
            }
        }

        // Remove disappeared tracks
        for (const trackId of disappeared) {
            delete this.disappeared[trackId];
        }

        // Update tracks
        this.tracks = currentTracks;

        return { tracks: this.tracks, updated, disappeared };
    }

    /**
     * Draw detections and tracks on a canvas for visualization
     * @param {HTMLCanvasElement} canvas - Canvas to draw on
     * @param {Array} detections - Current detections
     * @param {Object} tracks - Current tracks
     */
    drawDetections(canvas, detections, tracks) {
        const ctx = canvas.getContext('2d');

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw detections
        detections.forEach(detection => {
            const [x, y, width, height] = detection.bbox;

            // Draw bounding box
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            // Draw label with confidence
            ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.font = '12px Arial';
            ctx.fillText(
                `Person: ${Math.round(detection.score * 100)}%`,
                x, y > 20 ? y - 5 : y + height + 15
            );
        });

        // Draw tracks (show history and IDs)
        Object.values(tracks).forEach(track => {
            // Draw track history as line connecting centroids
            if (track.history.length > 1) {
                ctx.beginPath();

                // Start line at oldest position
                const firstPoint = track.history[0].centroid;
                ctx.moveTo(firstPoint[0], firstPoint[1]);

                // Draw line through all positions
                for (let i = 1; i < track.history.length; i++) {
                    const point = track.history[i].centroid;
                    ctx.lineTo(point[0], point[1]);
                }

                // Set line style and draw
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw track ID at latest position
                const latestPoint = track.history[track.history.length - 1].centroid;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
                ctx.font = '14px Arial';
                ctx.fillText(`ID: ${track.id}`, latestPoint[0], latestPoint[1]);
            }
        });
    }

    /**
     * Get all currently active tracks
     * @returns {Object} All active tracks
     */
    getActiveTracks() {
        return { ...this.tracks };
    }

    /**
     * Get a specific track by ID
     * @param {number} trackId - Track ID
     * @returns {Object|null} Track object or null if not found
     */
    getTrack(trackId) {
        return this.tracks[trackId] || null;
    }
}
