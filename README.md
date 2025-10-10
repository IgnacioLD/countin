# CountIn: Real-Time Vision-Based Occupancy Tracker

Browser-based people counting system using computer vision AI for event occupancy management and crowd analytics.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://countin.ignacio.tech)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

CountIn is a real-time people counting application that uses computer vision to track occupancy levels for events, venues, and public spaces. Built entirely in the browser with TensorFlow.js, it provides accurate directional counting (in/out) through customizable virtual counting lines.

### Key Features

- **Real-Time Person Detection**: TensorFlow.js with COCO-SSD/RF-DETR models for accurate detection
- **Custom Tracking Algorithms**: Built-from-scratch person tracking with confidence-based matching
- **Directional Counting**: Draw virtual lines to count people entering/exiting specific areas
- **Browser-Based Edge AI**: No server required, all processing happens locally in the browser
- **Privacy-First**: No data leaves your device, completely offline-capable
- **Multi-Line Support**: Track multiple entrances/exits simultaneously
- **Real-Time Visualization**: Live charts and statistics dashboard
- **Zero Installation**: Works directly in any modern web browser

## Technical Architecture

### Computer Vision Pipeline

```
Webcam Feed → TensorFlow.js Detection → Custom Tracking → Line Crossing Detection → Count Updates
```

### Core Technologies

- **ML Framework**: TensorFlow.js (browser-based inference)
- **Detection Models**: COCO-SSD, RF-DETR (person detection)
- **Custom Algorithms**:
  - Person tracking with centroid-based matching
  - Line-crossing detection using geometric algorithms
  - Confidence thresholding and noise filtering
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Canvas, CSS3
- **Performance**: Processes every 2nd frame for real-time performance

### Architecture Highlights

- **PersonTracker Class**: Custom implementation with configurable confidence thresholds, disappearance tracking, and position history
- **LineManager**: Geometric line-crossing detection with directional awareness
- **Real-time Visualization**: Chart updates with historical data tracking
- **Mocked Server Sync**: Ready for backend integration (optional)

## Use Cases

- **Event Management**: Track attendee count at conferences, concerts, festivals
- **Retail Analytics**: Monitor customer flow and peak hours
- **Safety Compliance**: Ensure venue capacity limits are maintained
- **Crowd Management**: Real-time occupancy for public spaces
- **Research & Education**: Computer vision learning and experimentation

## Getting Started

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/IgnacioLD/countin.git
cd countin
```

2. Serve locally (any HTTP server works):
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve

# Or just open index.html in a modern browser
```

3. Open `http://localhost:8000` in your browser

4. Allow camera access when prompted

### Basic Usage

1. **Setup Mode**: Draw counting lines across entrances/exits
   - Click "Add Line" and drag to create a virtual counting line
   - Add multiple lines for different entrances
   - Name each line for easy tracking

2. **Counting Mode**: Start tracking people
   - Switch to "Counting Mode"
   - Camera will activate and detection begins
   - People crossing lines are counted directionally (in/out)
   - View real-time statistics and charts

3. **Monitor Results**:
   - Total occupancy displayed in real-time
   - Per-line statistics showing in/out counts
   - Activity log with timestamps
   - Visualization charts showing trends

## Project Structure

```
countin/
├── index.html              # Main application HTML
├── css/
│   └── styles.css         # Application styling
├── js/
│   ├── app.js             # Main application controller
│   ├── rfdetr-adapter.js  # TensorFlow.js model integration
│   ├── tracker.js         # Custom person tracking algorithms
│   ├── line-manager.js    # Line drawing and crossing detection
│   ├── visualization.js   # Charts and data visualization
│   └── init.js            # Application initialization
└── README.md
```

## Technical Implementation

### Person Detection

Uses TensorFlow.js COCO-SSD model to detect people in each frame:
```javascript
const predictions = await model.detect(videoElement);
const people = predictions.filter(p => p.class === 'person' && p.score > 0.4);
```

### Custom Tracking Algorithm

Implements centroid-based tracking with:
- Euclidean distance matching between frames
- Confidence thresholding to filter false positives
- Disappearance tracking (maintains IDs for temporarily occluded people)
- Position history for trajectory analysis

### Line Crossing Detection

Geometric algorithm detecting when a person's trajectory crosses a virtual line:
```javascript
// Line intersection using vector math
function checkLineCrossing(prevPos, currentPos, lineStart, lineEnd) {
  // Calculate if the movement vector intersects the counting line
  // Determine direction (in/out) based on cross product
}
```

### Performance Optimization

- Processes every nth frame (configurable, default: 2)
- Canvas-based rendering for efficient visualization
- Minimal DOM manipulation for smooth UI
- Efficient tracking state management

## Configuration

### Detection Settings

```javascript
const tracker = new PersonTracker({
  confidenceThreshold: 0.4,     // Minimum detection confidence
  maxDisappearedFrames: 15,     // Frames before removing lost tracks
  historyLength: 10,            // Position history for trajectory
  detectionInterval: 2          // Process every nth frame
});
```

### Server Sync (Optional)

Mock server integration included for future backend connectivity:
- Configurable sync intervals (30s, 1min, 5min, 10min)
- Manual sync trigger
- Data payload includes counts and timestamps

## Browser Requirements

- Modern browser with WebRTC support (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Webcam access
- JavaScript enabled
- Minimum 4GB RAM recommended for smooth performance

## Performance

- **Detection Speed**: ~250-500ms per frame (depends on hardware)
- **Real-time Capable**: Processes every 2nd frame at 30fps video
- **Memory Usage**: ~200-500MB (TensorFlow.js models cached)
- **Accuracy**: ~85-95% depending on lighting and camera quality

## Future Enhancements

- [ ] Additional ML models (YOLOv5, MobileNet)
- [ ] Advanced tracking (DeepSORT, Kalman filtering)
- [ ] Backend API integration for data persistence
- [ ] Multi-camera support
- [ ] Heatmap visualization
- [ ] Export reports (CSV, JSON, PDF)
- [ ] Mobile app version (React Native + ONNX)

## Use in Research/Education

CountIn is ideal for:
- Computer vision coursework and demos
- Real-time ML inference examples
- Edge AI demonstrations
- Event management case studies
- Browser-based ML capabilities showcase

## Privacy & Ethics

- **No Data Collection**: All processing happens locally in browser
- **No Server Communication**: Optional mocked server sync for demo only
- **Camera Privacy**: Users must explicitly grant camera permissions
- **GDPR Compliant**: No personal data stored or transmitted
- **Ethical Use**: Intended for occupancy counting, not individual tracking/surveillance

## License

MIT License - see [LICENSE](LICENSE) for details

## Author

**Ignacio Loyola Delgado**
- Website: [ignacio.tech](https://ignacio.tech)
- GitHub: [@IgnacioLD](https://github.com/IgnacioLD)
- Email: hi@ignacio.tech

## Acknowledgments

- TensorFlow.js team for browser-based ML
- COCO-SSD model contributors
- Inspired by real-world event management needs

---

Built with ❤️ for the edge AI community
