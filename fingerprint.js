const { createCanvas } = require('canvas');

class FingerprintCollector {
    constructor() {
        this.fingerprintData = {};
    }

    // Canvas fingerprinting
    getCanvasFingerprint() {
        try {
            const canvas = createCanvas(200, 200);
            const ctx = canvas.getContext('2d');
            
            // Text with specific styling
            ctx.textBaseline = "top";
            ctx.font = '14px "Arial"';
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Fingerprint", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Fingerprint", 4, 17);
            
            const dataUrl = canvas.toDataURL();
            
            // Simple hash of canvas data
            let hash = 0;
            for (let i = 0; i < dataUrl.length; i++) {
                hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
                hash = hash & hash;
            }
            
            return {
                dataHash: hash,
                width: canvas.width,
                height: canvas.height
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // Get timezone info
    getTimezoneInfo() {
        return {
            offset: new Date().getTimezoneOffset(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: Intl.DateTimeFormat().resolvedOptions().locale
        };
    }

    // Generate browser fingerprint from user agent
    generateBrowserFingerprint(userAgent) {
        // Simple fingerprint generation algorithm
        const components = [
            userAgent,
            navigator.platform,
            navigator.language,
            new Date().getTimezoneOffset(),
            screen.width + 'x' + screen.height,
            screen.colorDepth
        ].join('|');
        
        let hash = 0;
        for (let i = 0; i < components.length; i++) {
            const char = components.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // Collect all fingerprint data
    collectAllFingerprintData(req) {
        const userAgent = req.headers['user-agent'] || '';
        
        this.fingerprintData = {
            timestamp: new Date().toISOString(),
            
            // Basic fingerprint
            browserFingerprint: this.generateBrowserFingerprint(userAgent),
            
            // Canvas fingerprint
            canvas: this.getCanvasFingerprint(),
            
            // Timezone info
            timezone: this.getTimezoneInfo(),
            
            // Screen properties
            screen: {
                width: req.headers['screen-width'] || '',
                height: req.headers['screen-height'] || '',
                colorDepth: req.headers['color-depth'] || '',
                pixelRatio: req.headers['pixel-ratio'] || ''
            },
            
            // Performance API data (if available)
            performance: {
                memory: req.headers['device-memory'] || '',
                concurrency: req.headers['hardware-concurrency'] || '',
                connection: req.headers['connection'] || ''
            },
            
            // Network information
            network: {
                downlink: req.headers['downlink'] || '',
                effectiveType: req.headers['effective-type'] || '',
                rtt: req.headers['rtt'] || '',
                saveData: req.headers['save-data'] || ''
            }
        };
        
        return this.fingerprintData;
    }
}

module.exports = FingerprintCollector;
