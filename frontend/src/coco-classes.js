/**
 * COCO-SSD class names (80 classes) returned by the model.
 * Order matches the official COCO class ids.
 */
export const COCO_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
    'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
    'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
    'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
    'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
    'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
    'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
    'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
];

/**
 * Curated, commonly-counted classes shown as quick picks in the UI.
 */
export const POPULAR_CLASSES = [
    'person', 'car', 'truck', 'bus', 'bicycle', 'motorcycle', 'dog', 'cat', 'bird', 'horse',
];

/** Emoji glyph per class for compact UI labels. Falls back to a dot. */
export const CLASS_ICONS = {
    person: '🧍', bicycle: '🚲', car: '🚗', motorcycle: '🏍️', airplane: '✈️', bus: '🚌',
    train: '🚆', truck: '🚚', boat: '⛵', 'traffic light': '🚦', 'fire hydrant': '🚒',
    'stop sign': '🛑', 'parking meter': '🅿️', bench: '🪑', bird: '🐦', cat: '🐱', dog: '🐶',
    horse: '🐴', sheep: '🐑', cow: '🐄', elephant: '🐘', bear: '🐻', zebra: '🦓', giraffe: '🦒',
    backpack: '🎒', umbrella: '☂️', handbag: '👜', tie: '👔', suitcase: '🧳', frisbee: '🥏',
    skis: '🎿', snowboard: '🏂', 'sports ball': '⚽', kite: '🪁', 'baseball bat': '🏏',
    'baseball glove': '🧤', skateboard: '🛹', surfboard: '🏄', 'tennis racket': '🎾',
    bottle: '🍶', 'wine glass': '🍷', cup: '☕', fork: '🍴', knife: '🔪', spoon: '🥄',
    bowl: '🥣', banana: '🍌', apple: '🍎', sandwich: '🥪', orange: '🍊', broccoli: '🥦',
    carrot: '🥕', 'hot dog': '🌭', pizza: '🍕', donut: '🍩', cake: '🍰', chair: '🪑',
    couch: '🛋️', 'potted plant': '🪴', bed: '🛏️', 'dining table': '🍽️', toilet: '🚽',
    tv: '📺', laptop: '💻', mouse: '🖱️', remote: 'remote', keyboard: '⌨️',
    'cell phone': '📱', microwave: 'microwave', oven: 'oven', toaster: 'toaster', sink: 'sink',
    refrigerator: 'fridge', book: '📕', clock: '🕐', vase: '🏺', scissors: '✂️',
    'teddy bear': '🧸', 'hair drier': '💨', toothbrush: '🪥',
};
