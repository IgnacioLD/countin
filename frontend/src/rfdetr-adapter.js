/**
 * Detection adapter around TensorFlow.js COCO-SSD.
 *
 * There is deliberately NO fallback when the model cannot be loaded: a
 * silent mock would fabricate people and corrupt counts in production.
 * Load failures propagate to the caller, which surfaces them in the UI
 * and offers a retry.
 */
window.rfdetrAdapter = (() => {
    // Private state
    let model = null;
    let isLoaded = false;
    let isLoading = false;
    let loadFailed = false;

    /**
     * Add timeout to a promise
     */
    function withTimeout(promise, timeoutMs, errorMessage) {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
            )
        ]);
    }

    /**
     * Load the COCO-SSD model.
     * The libraries are npm dependencies loaded through dynamic import so the
     * large TensorFlow.js bundle is fetched only when counting starts.
     * @returns {Promise<Object>} Loaded model
     * @throws when the model weights cannot be downloaded
     */
    async function loadModel() {
        if (isLoaded && model) {
            return model;
        }

        // If currently loading, wait for it to complete
        if (isLoading) {
            return new Promise((resolve, reject) => {
                const checkLoaded = setInterval(() => {
                    if (isLoaded && model) {
                        clearInterval(checkLoaded);
                        resolve(model);
                    } else if (!isLoading) {
                        clearInterval(checkLoaded);
                        reject(new Error('Model loading failed'));
                    }
                }, 100);
            });
        }

        isLoading = true;
        loadFailed = false;
        try {
            // Import the full tfjs package first: it registers the WebGL
            // backend, which the coco-ssd package alone does not.
            const tf = await import('@tensorflow/tfjs');
            const cocoSsd = await import('@tensorflow-models/coco-ssd');
            await tf.ready();

            // Prefer the self-hosted lite model (served from this origin, so
            // it works even where the model CDN is blocked or slow), then
            // fall back to the CDN variants.
            const attempts = [
                () => cocoSsd.load({ modelUrl: '/models/ssdlite/model.json' }),
                () => cocoSsd.load({ base: 'lite_mobilenet_v2' }),
                () => cocoSsd.load(),
            ];

            let lastError = null;
            for (const attempt of attempts) {
                try {
                    model = await withTimeout(
                        attempt(),
                        60000,
                        'Model loading timed out after 60 seconds'
                    );
                    break;
                } catch (e) {
                    lastError = e;
                    console.warn('Model source failed, trying next source', e.message);
                }
            }
            if (!model) throw lastError;

            isLoaded = true;
            console.log('COCO-SSD model loaded successfully');
            return model;
        } catch (error) {
            loadFailed = true;
            throw error;
        } finally {
            isLoading = false;
        }
    }

    /**
     * Clear a failed load so the next loadModel() attempt starts fresh.
     * Used by the retry action in the model error UI.
     */
    function resetLoader() {
        if (isLoading) return;
        model = null;
        isLoaded = false;
        loadFailed = false;
    }

    /**
     * Detect objects in an image or video frame
     * @param {HTMLImageElement|HTMLVideoElement} input - Input element
     * @param {Array<string>=} classes - Optional allow-list of class names; omit for all COCO classes
     * @returns {Promise<Array>} Array of detections {bbox:[x,y,w,h], class, score}
     */
    async function detectObjects(input, classes) {
        if (!isLoaded) {
            // A previous load failed: report no detections instead of
            // hammering the network with per-frame retries. The error UI
            // owns the retry.
            if (loadFailed) return [];
            await loadModel();
        }

        try {
            const predictions = await model.detect(input);
            const allow = Array.isArray(classes) && classes.length > 0 ? new Set(classes) : null;

            return predictions
                .filter(pred => !allow || allow.has(pred.class))
                .map(pred => ({
                    bbox: [pred.bbox[0], pred.bbox[1], pred.bbox[2], pred.bbox[3]],
                    class: pred.class,
                    score: pred.score,
                }));
        } catch (error) {
            console.error('Detection error:', error);
            return [];
        }
    }

    // Public API
    return {
        loadModel,
        resetLoader,
        detectObjects,

        // State inspection for debugging
        getState: () => ({ isLoaded, isLoading, loadFailed })
    };
})();
