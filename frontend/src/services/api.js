/**
 * API Service for backend communication
 */

// Use environment variable for API URL, fallback to relative path for dev
let API_URL = import.meta.env.VITE_API_URL || '';

// Runtime check: if on HTTPS but API URL is HTTP, fix it
if (window.location.protocol === 'https:' && API_URL.startsWith('http://')) {
    API_URL = API_URL.replace('http://', 'https://');
    console.warn('Fixed HTTP API URL to HTTPS:', API_URL);
}

// If no API URL is set and we're on production, construct it from hostname
if (!API_URL && window.location.hostname.includes('countin.ignacio.tech')) {
    API_URL = 'https://api.countin.ignacio.tech';
    console.log('Auto-detected API URL:', API_URL);
}

const API_BASE = `${API_URL}/api/v1`;

// Log the API configuration for debugging
console.log('API Configuration:', {
    'VITE_API_URL': import.meta.env.VITE_API_URL,
    'API_URL': API_URL,
    'API_BASE': API_BASE,
    'window.location': window.location.href
});

export class ApiService {
    constructor() {
        this.baseUrl = API_BASE;
        this.baseURL = API_URL || window.location.origin; // Full base URL for direct fetch calls
        this.currentSession = null;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Session endpoints
    async createSession(name, description = '') {
        const session = await this.request('/sessions/', {
            method: 'POST',
            body: JSON.stringify({ name, description }),
        });
        this.currentSession = session;
        return session;
    }

    async getSessions() {
        return this.request('/sessions/');
    }

    async getSession(sessionId) {
        return this.request(`/sessions/${sessionId}`);
    }

    async endSession(sessionId) {
        return this.request(`/sessions/${sessionId}/end`, { method: 'POST' });
    }

    async getSessionStats(sessionId) {
        return this.request(`/sessions/${sessionId}/stats`);
    }

    // Line endpoints
    async createLine(lineData) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        return this.request('/lines/', {
            method: 'POST',
            body: JSON.stringify({
                ...lineData,
                session_id: this.currentSession.id,
            }),
        });
    }

    async getSessionLines(sessionId) {
        return this.request(`/lines/session/${sessionId}`);
    }

    async updateLine(lineId, data) {
        return this.request(`/lines/${lineId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteLine(lineId) {
        return this.request(`/lines/${lineId}`, { method: 'DELETE' });
    }

    // Event endpoints
    async createEvent(eventData) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        return this.request('/events/', {
            method: 'POST',
            body: JSON.stringify({
                ...eventData,
                session_id: this.currentSession.id,
            }),
        });
    }

    async getSessionEvents(sessionId, filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/events/session/${sessionId}?${params}`);
    }

    // Snapshot endpoints
    async createSnapshot(snapshotData) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        return this.request('/snapshots/', {
            method: 'POST',
            body: JSON.stringify({
                ...snapshotData,
                session_id: this.currentSession.id,
            }),
        });
    }

    async getSessionSnapshots(sessionId) {
        return this.request(`/snapshots/session/${sessionId}`);
    }
}

export default new ApiService();
