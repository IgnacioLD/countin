/**
 * Person Tracker
 *
 * Detects people (via the rfdetr/coco-ssd adapter) and tracks stable identities
 * across frames. Designed for accurate line-crossing counting:
 *  - Global greedy data association (best pair first) to avoid ID swaps.
 *  - Combined IoU + centroid-distance cost so fast motion / sparse detection
 *    frames don't spawn new IDs (which loses crossings).
 *  - Constant-velocity prediction for coasting tracks.
 *  - Maintains a bounded position history with both centroid and foot point.
 */
export class PersonTracker {
    constructor(options = {}) {
        // Detection
        this.confidenceThreshold = options.confidenceThreshold ?? 0.4;
        // Which object classes to detect & track (any COCO-SSD class).
        this.targetClasses = Array.isArray(options.targetClasses) && options.targetClasses.length
            ? [...options.targetClasses]
            : ['person'];

        // Tracking longevity
        this.maxDisappearedFrames = options.maxDisappearedFrames ?? 15;
        this.historyLength = options.historyLength ?? 10;

        // Association tuning
        this.minIoU = options.minIoU ?? 0.2;          // IoU gate for direct overlap
        this.maxCenterDist = options.maxCenterDist ?? 120; // px fallback gate for fast motion

        // Model
        this.model = null;
        this.isModelLoaded = false;

        // Tracking state
        this.nextTrackId = 1;
        this.tracks = {};          // active tracks by id
        this.disappeared = {};     // frames each id has been unseen

        // Callbacks
        this.onTrackUpdated = options.onTrackUpdated || null;

        this.debugMode = options.debugMode || false;
    }

    async initialize() {
        if (this.isModelLoaded) return true;
        this.model = await window.rfdetrAdapter.loadModel();
        this.isModelLoaded = true;
        return true;
    }

    async processFrame(videoElement, canvas = null) {
        if (!this.isModelLoaded && !window.useSyntheticDetections) {
            throw new Error('Tracker model not initialized. Call initialize() first.');
        }

        let detections = window.useSyntheticDetections
            ? this.generateSyntheticDetections(canvas)
            : await this.detectPeople(videoElement);

        const result = this.updateTracks(detections);

        if (canvas) {
            this.drawDetections(canvas, videoElement, detections, result.tracks);
        }

        return result;
    }

    async detectPeople(videoElement) {
        try {
            const predictions = await window.rfdetrAdapter.detectObjects(videoElement, this.targetClasses);
            return predictions.filter(p => p.score >= this.confidenceThreshold);
        } catch (error) {
            console.error('Detection error:', error);
            return [];
        }
    }

    /** Change which classes are counted at runtime. */
    setTargetClasses(classes) {
        this.targetClasses = Array.isArray(classes) && classes.length ? [...classes] : ['person'];
    }

    /* ---------------- Data association ---------------- */

    /**
     * Update tracks from the latest detections using global greedy matching.
     */
    updateTracks(detections) {
        const updated = [];
        const currentTracks = {};
        const trackIds = Object.keys(this.tracks).map(Number);

        // No detections: age everything, keep coasting tracks until they expire.
        if (detections.length === 0) {
            return this.handleDisappearances({}, updated);
        }

        // No existing tracks: everything is new.
        if (trackIds.length === 0) {
            for (const det of detections) {
                const id = this.nextTrackId++;
                this.initializeTrackInto(id, det, currentTracks);
                this.disappeared[id] = 0;
                updated.push(id);
                this.fireUpdate(id, currentTracks[id]);
            }
            this.tracks = currentTracks;
            return { tracks: this.tracks, updated, disappeared: [] };
        }

        // Build candidate pairs (track, detection) that pass either gate.
        // Class-aware: only associate detections with tracks of the same class.
        const candidates = [];
        for (const id of trackIds) {
            const track = this.tracks[id];
            const pred = this.predictedCenter(track);
            for (let j = 0; j < detections.length; j++) {
                const det = detections[j];
                if (det.class !== track.classLabel) continue;
                const detCenter = centerOf(det.bbox);
                const iou = this.calculateIoU(this.predictedBox(track), det.bbox);
                const dist = distance(pred, detCenter);

                let cost = Infinity;
                if (iou >= this.minIoU) {
                    cost = 1 - iou;                       // overlap-based: best signal
                } else if (dist <= this.maxCenterDist) {
                    cost = 1 - iou + (dist / this.maxCenterDist) * 0.5; // motion fallback, ranked below real overlap
                } else {
                    continue;                              // no plausible association
                }
                candidates.push({ id, j, cost });
            }
        }

        // Global greedy: assign strongest (lowest-cost) pairs first.
        candidates.sort((a, b) => a.cost - b.cost);
        const usedTracks = new Set();
        const usedDets = new Set();
        const matches = new Map(); // trackId -> detectionIdx
        for (const c of candidates) {
            if (usedTracks.has(c.id) || usedDets.has(c.j)) continue;
            usedTracks.add(c.id);
            usedDets.add(c.j);
            matches.set(c.id, c.j);
        }

        // Apply matches.
        for (const id of trackIds) {
            if (matches.has(id)) {
                const det = detections[matches.get(id)];
                this.updateTrack(id, this.tracks[id], det);
                currentTracks[id] = this.tracks[id];
                this.disappeared[id] = 0;
                updated.push(id);
                this.fireUpdate(id, this.tracks[id]);
            }
        }

        // Spawn new tracks for unmatched detections.
        for (let j = 0; j < detections.length; j++) {
            if (usedDets.has(j)) continue;
            const id = this.nextTrackId++;
            this.initializeTrackInto(id, detections[j], currentTracks);
            this.disappeared[id] = 0;
            updated.push(id);
        }

        return this.handleDisappearances(currentTracks, updated);
    }

    fireUpdate(id, track) {
        if (this.onTrackUpdated) {
            try { this.onTrackUpdated(id, track); } catch (e) { console.error(e); }
        }
    }

    /**
     * Predict where a track's box should be now, using recent velocity.
     * Frames-since-update scales the motion so coasting tracks keep moving.
     */
    predictedCenter(track) {
        const h = track.history;
        if (h.length === 0) return [track.bbox[0] + track.bbox[2] / 2, track.bbox[1] + track.bbox[3] / 2];
        const last = h[h.length - 1].centroid;
        if (h.length < 2) return last;
        const prev = h[h.length - 2].centroid;
        const vx = last[0] - prev[0];
        const vy = last[1] - prev[1];
        const step = (this.disappeared[track.id] || 0) + 1;
        return [last[0] + vx * step, last[1] + vy * step];
    }

    predictedBox(track) {
        const h = track.history;
        const [, , w, hh] = track.bbox;
        if (h.length < 2) return track.bbox;
        const last = h[h.length - 1].centroid;
        const prev = h[h.length - 2].centroid;
        const step = (this.disappeared[track.id] || 0) + 1;
        const cx = last[0] + (last[0] - prev[0]) * step;
        const cy = last[1] + (last[1] - prev[1]) * step;
        return [cx - w / 2, cy - hh / 2, w, hh];
    }

    initializeTrack(id, detection) {
        const holder = {};
        this.initializeTrackInto(id, detection, holder);
        return holder[id];
    }

    initializeTrackInto(id, detection, target) {
        const [x, y, w, h] = detection.bbox;
        const centroid = [x + w / 2, y + h / 2];
        const footPoint = [x + w / 2, y + h];
        const track = {
            id,
            classLabel: detection.class || 'person',
            bbox: detection.bbox,
            lastSeen: Date.now(),
            history: [{
                timestamp: Date.now(),
                bbox: detection.bbox,
                centroid,
                footPoint,
                score: detection.score,
            }],
            isMovingAcross: detection.isMovingAcross,
        };
        target[id] = track;
        return track;
    }

    updateTrack(trackId, track, detection) {
        const [x, y, w, h] = detection.bbox;
        const centroid = [x + w / 2, y + h / 2];
        const footPoint = [x + w / 2, y + h];

        track.lastSeen = Date.now();
        track.bbox = detection.bbox;
        track.history.push({
            timestamp: Date.now(),
            bbox: detection.bbox,
            centroid,
            footPoint,
            score: detection.score,
        });
        if (track.history.length > this.historyLength) track.history.shift();
        if (detection.isMovingAcross !== undefined) track.isMovingAcross = detection.isMovingAcross;
    }

    calculateIoU(bbox1, bbox2) {
        const ax2 = bbox1[0] + bbox1[2], ay2 = bbox1[1] + bbox1[3];
        const bx2 = bbox2[0] + bbox2[2], by2 = bbox2[1] + bbox2[3];
        const xOverlap = Math.max(0, Math.min(ax2, bx2) - Math.max(bbox1[0], bbox2[0]));
        const yOverlap = Math.max(0, Math.min(ay2, by2) - Math.max(bbox1[1], bbox2[1]));
        const intersection = xOverlap * yOverlap;
        const union = bbox1[2] * bbox1[3] + bbox2[2] * bbox2[3] - intersection;
        return union > 0 ? intersection / union : 0;
    }

    handleDisappearances(currentTracks, updated) {
        const disappeared = [];
        for (const idStr in this.tracks) {
            const id = Number(idStr);
            if (!currentTracks[id]) {
                this.disappeared[id] = (this.disappeared[id] || 0) + 1;
                if (this.disappeared[id] > this.maxDisappearedFrames) {
                    disappeared.push(id);
                } else {
                    // Coast: keep the track at its last known position.
                    currentTracks[id] = this.tracks[id];
                }
            }
        }
        for (const id of disappeared) {
            delete this.disappeared[id];
            delete currentTracks[id];
        }
        this.tracks = currentTracks;
        return { tracks: this.tracks, updated, disappeared };
    }

    /* ---------------- Synthetic (test) detections ---------------- */

    generateSyntheticDetections(canvas) {
        const width = canvas ? canvas.width : 640;
        const height = canvas ? canvas.height : 480;
        if (Math.random() > 0.3) {
            const existing = Object.values(this.tracks);
            if (existing.length === 0) return this.generateNewSyntheticDetections(width, height, 1);
            return existing.map(track => {
                const last = track.history[track.history.length - 1];
                if (!last) return null;
                let xMove = (Math.random() - 0.5) * 5;
                let yMove = (Math.random() - 0.5) * 5;
                if (track.isMovingAcross) {
                    const cx = width / 2;
                    const d = last.bbox[0] - cx;
                    if (Math.abs(d) < 50) xMove = d < 0 ? 15 : -15;
                    else xMove = d < 0 ? 8 : -8;
                    yMove = (Math.random() - 0.5) * 3;
                }
                const nx = Math.max(0, Math.min(width - last.bbox[2], last.bbox[0] + xMove));
                const ny = Math.max(0, Math.min(height - last.bbox[3], last.bbox[1] + yMove));
                return {
                    class: 'person', score: 0.9,
                    bbox: [nx, ny, last.bbox[2], last.bbox[3]],
                    isMovingAcross: track.isMovingAcross,
                };
            }).filter(Boolean);
        }
        return this.generateNewSyntheticDetections(width, height, Math.floor(Math.random() * 2) + 1);
    }

    generateNewSyntheticDetections(width, height, count) {
        const detections = [];
        const cx = width / 2;
        for (let i = 0; i < count; i++) {
            const shouldCross = Math.random() > 0.5;
            let x;
            if (shouldCross) {
                x = Math.random() > 0.5 ? cx - 200 - Math.random() * 100 : cx + 100 + Math.random() * 100;
            } else {
                x = Math.random() * (width - 200);
                if (Math.abs(x - cx) < 100) x = x < cx ? x - 100 : x + 100;
            }
            const bw = Math.random() * 50 + 50;
            const bh = Math.random() * 100 + 100;
            const y = Math.random() * (height - bh - 50) + 50;
            detections.push({
                class: 'person',
                score: 0.8 + Math.random() * 0.2,
                bbox: [Math.max(0, Math.min(width - bw, x)), y, bw, bh],
                isMovingAcross: shouldCross,
            });
        }
        return detections;
    }

    /* ---------------- Visualization ---------------- */

    drawDetections(canvas, videoElement, detections, tracks) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scaleX = canvas.width / (videoElement.videoWidth || canvas.width);
        const scaleY = canvas.height / (videoElement.videoHeight || canvas.height);

        for (const det of detections) {
            const [x, y, w, h] = det.bbox;
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.85)';
            ctx.font = '12px Arial';
            const label = `${det.class} ${Math.round(det.score * 100)}%`;
            ctx.fillText(label, x * scaleX, y * scaleY > 20 ? y * scaleY - 5 : y * scaleY + h * scaleY + 15);
        }

        for (const track of Object.values(tracks)) {
            if (track.history.length > 1) {
                ctx.beginPath();
                const f = track.history[0].centroid;
                ctx.moveTo(f[0] * scaleX, f[1] * scaleY);
                for (let i = 1; i < track.history.length; i++) {
                    const p = track.history[i].centroid;
                    ctx.lineTo(p[0] * scaleX, p[1] * scaleY);
                }
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();
                const last = track.history[track.history.length - 1].centroid;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.95)';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(`#${track.id}`, last[0] * scaleX, last[1] * scaleY);
            }
        }
    }

    getActiveTracks() { return { ...this.tracks }; }
    getTrack(trackId) { return this.tracks[trackId] || null; }
}

/* ---------- geometry helpers ---------- */
function centerOf(bbox) {
    return [bbox[0] + bbox[2] / 2, bbox[1] + bbox[3] / 2];
}
function distance(a, b) {
    const dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
}
