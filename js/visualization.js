/**
 * visualization.js
 * Creates visualizations for people counting data
 */
class CountingVisualization {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.data = [];
        this.maxDataPoints = 20;

        // Initialize the canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.clientWidth || 300;
        this.canvas.height = this.container.clientHeight || 200;
        this.ctx = this.canvas.getContext('2d');

        // Add to container
        this.container.appendChild(this.canvas);

        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = this.container.clientWidth || 300;
            this.render();
        });

        // Initial render
        this.render();
    }

    /**
     * Add a data point to the visualization
     * @param {Object} counts - Count data {total, in, out}
     */
    addDataPoint(counts) {
        this.data.push({
            timestamp: new Date(),
            counts: { ...counts }
        });

        // Limit data points
        if (this.data.length > this.maxDataPoints) {
            this.data.shift();
        }

        this.render();
    }

    /**
     * Clear all data
     */
    clearData() {
        this.data = [];
        this.render();
    }

    /**
     * Render the visualization
     */
    render() {
        const { width, height } = this.canvas;
        const ctx = this.ctx;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        // If no data, show message
        if (this.data.length === 0) {
            ctx.fillStyle = '#6c757d';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No data available', width / 2, height / 2);
            return;
        }

        // Find max value for scaling
        const maxValue = Math.max(
            ...this.data.map(d => d.counts.total),
            5 // Minimum max value
        );

        // Calculate padding
        const padding = { left: 40, right: 20, top: 20, bottom: 30 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Draw axis
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 1;

        // Y axis
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.stroke();

        // X axis
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        // Draw Y axis labels
        ctx.fillStyle = '#6c757d';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';

        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight * (5 - i) / 5);
            const value = Math.round(maxValue * i / 5);

            ctx.fillText(value.toString(), padding.left - 5, y);

            // Draw grid line
            ctx.strokeStyle = '#f1f3f5';
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        // Draw data lines
        if (this.data.length > 1) {
            // Calculate X step
            const xStep = chartWidth / (this.maxDataPoints - 1);

            // Draw total counts (blue)
            this.drawDataLine(this.data.map(d => d.counts.total), '#0062cc', maxValue, xStep, padding, chartHeight);

            // Draw IN counts (green)
            this.drawDataLine(this.data.map(d => d.counts.in), '#28a745', maxValue, xStep, padding, chartHeight);

            // Draw OUT counts (red)
            this.drawDataLine(this.data.map(d => d.counts.out), '#dc3545', maxValue, xStep, padding, chartHeight);
        }

        // Draw legend
        this.drawLegend(width, padding);
    }

    /**
     * Draw a data line on the chart
     * @param {Array} values - Array of data values
     * @param {string} color - Line color
     * @param {number} maxValue - Maximum value for scaling
     * @param {number} xStep - X step size
     * @param {Object} padding - Chart padding
     * @param {number} chartHeight - Chart height
     */
    drawDataLine(values, color, maxValue, xStep, padding, chartHeight) {
        const ctx = this.ctx;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        // Only draw for available data points
        const dataLength = Math.min(values.length, this.maxDataPoints);

        for (let i = 0; i < dataLength; i++) {
            const value = values[i];
            const x = padding.left + i * xStep;
            // Scale value and invert Y axis
            const y = padding.top + chartHeight - (value / maxValue * chartHeight);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Draw points
        ctx.fillStyle = color;
        for (let i = 0; i < dataLength; i++) {
            const value = values[i];
            const x = padding.left + i * xStep;
            const y = padding.top + chartHeight - (value / maxValue * chartHeight);

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Draw chart legend
     * @param {number} width - Canvas width
     * @param {Object} padding - Chart padding
     */
    drawLegend(width, padding) {
        const ctx = this.ctx;
        const legendItems = [
            { label: 'Total', color: '#0062cc' },
            { label: 'In', color: '#28a745' },
            { label: 'Out', color: '#dc3545' }
        ];

        const legendWidth = 60;
        const legendX = padding.left + (width - padding.left - padding.right - legendWidth * legendItems.length) / 2;
        const legendY = 10;

        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        legendItems.forEach((item, index) => {
            const x = legendX + index * legendWidth;

            // Draw color box
            ctx.fillStyle = item.color;
            ctx.fillRect(x, legendY, 10, 10);

            // Draw label
            ctx.fillStyle = '#333';
            ctx.fillText(item.label, x + 15, legendY + 5);
        });
    }
}