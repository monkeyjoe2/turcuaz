// Advanced client-side data collection
class AdvancedDataCollector {
    constructor() {
        this.sessionId = this.getSessionId();
        this.collectedData = {
            clientData: {},
            performance: {},
            storage: {},
            webRTC: null,
            battery: null,
            mediaDevices: null
        };
        this.dataPoints = 0;
    }

    // Get or create session ID
    getSessionId() {
        let sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    // Collect screen information
    collectScreenInfo() {
        return {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            pixelRatio: window.devicePixelRatio || 1,
            orientation: screen.orientation ? screen.orientation.type : 'unknown'
        };
    }

    // Collect browser information
    collectBrowserInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            onLine: navigator.onLine,
            pdfViewerEnabled: navigator.pdfViewerEnabled || false,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            deviceMemory: navigator.deviceMemory || 'unknown',
            maxTouchPoints: navigator.maxTouchPoints || 0,
            vendor: navigator.vendor,
            product: navigator.product,
            productSub: navigator.productSub
        };
    }

    // Collect timezone information
    collectTimezoneInfo() {
        return {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            locale: Intl.DateTimeFormat().resolvedOptions().locale,
            calendar: Intl.DateTimeFormat().resolvedOptions().calendar
        };
    }

    // Collect performance information
    collectPerformanceInfo() {
        const perf = {};
        
        if ('performance' in window) {
            perf.timing = {};
            const timing = performance.timing;
            
            // Calculate various timing metrics
            if (timing) {
                perf.timing = {
                    navigationStart: timing.navigationStart,
                    loadEventEnd: timing.loadEventEnd,
                    domComplete: timing.domComplete,
                    domInteractive: timing.domInteractive,
                    domContentLoadedEventStart: timing.domContentLoadedEventStart,
                    domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
                    loadEventStart: timing.loadEventStart
                };
            }
            
            // Memory info (Chrome only)
            if (performance.memory) {
                perf.memory = {
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
            }
        }
        
        return perf;
    }

    // Collect network information
    async collectNetworkInfo() {
        const network = {};
        
        if ('connection' in navigator) {
            const conn = navigator.connection;
            network.effectiveType = conn.effectiveType;
            network.rtt = conn.rtt;
            network.downlink = conn.downlink;
            network.saveData = conn.saveData;
            network.type = conn.type;
        }
        
        // Try to get WebRTC IP (may reveal real IP behind VPN)
        try {
            const rtc = await this.getWebRTCIP();
            if (rtc) network.webRTC = rtc;
        } catch (e) {
            // WebRTC not available or blocked
        }
        
        return network;
    }

    // Get WebRTC IP (controversial but educational)
    async getWebRTCIP() {
        return new Promise((resolve) => {
            const RTCPeerConnection = window.RTCPeerConnection || 
                                     window.mozRTCPeerConnection || 
                                     window.webkitRTCPeerConnection;
            
            if (!RTCPeerConnection) {
                resolve(null);
                return;
            }
            
            const pc = new RTCPeerConnection({ iceServers: [] });
            const ips = [];
            
            pc.createDataChannel('');
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(() => resolve(null));
            
            pc.onicecandidate = (event) => {
                if (!event || !event.candidate) {
                    pc.close();
                    resolve(ips.length > 0 ? ips : null);
                    return;
                }
                
                const candidate = event.candidate.candidate;
                const regex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/;
                const match = candidate.match(regex);
                
                if (match) {
                    const ip = match[1];
                    if (ips.indexOf(ip) === -1) ips.push(ip);
                }
            };
            
            // Timeout after 1 second
            setTimeout(() => {
                pc.close();
                resolve(ips.length > 0 ? ips : null);
            }, 1000);
        });
    }

    // Collect battery information (if available)
    async collectBatteryInfo() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                return {
                    charging: battery.charging,
                    chargingTime: battery.chargingTime,
                    dischargingTime: battery.dischargingTime,
                    level: battery.level
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    // Collect media devices information
    async collectMediaDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return null;
        }
        
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.map(device => ({
                kind: device.kind,
                label: device.label,
                deviceId: device.deviceId,
                groupId: device.groupId
            }));
        } catch (e) {
            return null;
        }
    }

    // Collect storage information
    collectStorageInfo() {
        const storage = {
            localStorage: false,
            sessionStorage: false,
            indexedDB: false,
            cookiesEnabled: navigator.cookieEnabled
        };
        
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            storage.localStorage = true;
        } catch (e) {
            storage.localStorage = false;
        }
        
        try {
            sessionStorage.setItem('test', 'test');
            sessionStorage.removeItem('test');
            storage.sessionStorage = true;
        } catch (e) {
            storage.sessionStorage = false;
        }
        
        storage.indexedDB = 'indexedDB' in window;
        
        return storage;
    }

    // Canvas fingerprinting
    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 200;
            canvas.height = 200;
            
            // Draw text with specific styling
            ctx.textBaseline = "top";
            ctx.font = '14px "Arial"';
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Fingerprint", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Fingerprint", 4, 17);
            
            return canvas.toDataURL().length;
        } catch (e) {
            return null;
        }
    }

    // WebGL fingerprinting
    getWebGLInfo() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return null;
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                vendor: gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
                renderer: gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
            };
        } catch (e) {
            return null;
        }
    }

    // Collect fonts
    async getFonts() {
        const fonts = [
            'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New',
            'Courier', 'Verdana', 'Georgia', 'Palatino', 'Garamond',
            'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black',
            'Impact', 'Lucida Sans Unicode', 'Tahoma', 'Geneva'
        ];
        
        const availableFonts = [];
        
        // Simple font detection
        for (const font of fonts) {
            if (document.fonts.check(`12px "${font}"`)) {
                availableFonts.push(font);
            }
        }
        
        return availableFonts;
    }

    // Collect all data
    async collectAllData() {
        this.collectedData = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            
            screen: this.collectScreenInfo(),
            browser: this.collectBrowserInfo(),
            timezone: this.collectTimezoneInfo(),
            performance: this.collectPerformanceInfo(),
            network: await this.collectNetworkInfo(),
            battery: await this.collectBatteryInfo(),
            mediaDevices: await this.collectMediaDevices(),
            storage: this.collectStorageInfo(),
            
            fingerprint: {
                canvas: this.getCanvasFingerprint(),
                webgl: this.getWebGLInfo(),
                fonts: await this.getFonts(),
                touchSupport: 'ontouchstart' in window,
                platform: navigator.platform,
                plugins: Array.from(navigator.plugins).map(p => p.name).join(','),
                mimeTypes: Array.from(navigator.mimeTypes).map(m => m.type).join(',')
            },
            
            // Additional data points
            additional: {
                referrer: document.referrer,
                url: window.location.href,
                title: document.title,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                cookies: document.cookie ? document.cookie.split(';').length : 0,
                localStorageItems: localStorage.length,
                sessionStorageItems: sessionStorage.length
            }
        };
        
        this.dataPoints = Object.keys(this.collectedData).length;
        return this.collectedData;
    }

    // Send data to server
    async sendToServer() {
        try {
            const data = await this.collectAllData();
            
            const response = await fetch('/api/collect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Screen-Width': data.screen.width,
                    'Screen-Height': data.screen.height,
                    'Color-Depth': data.screen.colorDepth,
                    'Pixel-Ratio': data.screen.pixelRatio,
                    'Device-Memory': data.browser.deviceMemory,
                    'Hardware-Concurrency': data.browser.hardwareConcurrency,
                    'Viewport-Width': data.additional.viewport.width,
                    'Viewport-Height': data.additional.viewport.height
                },
                body: JSON.stringify({
                    clientData: data,
                    timestamp: new Date().toISOString()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update UI with session info
                document.getElementById('sessionId').textContent = result.sessionId;
                document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                document.getElementById('dataPoints').textContent = `${this.dataPoints} data points collected`;
                
                // Update notification
                this.showNotification('Data collection successful!', 'success');
                
                return result;
            }
        } catch (error) {
            console.log('Failed to send data to server (expected in some cases)');
            this.showNotification('Data collection completed (offline mode)', 'warning');
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.getElementById('dataNotification');
        if (notification) {
            const icon = notification.querySelector('i');
            const text = notification.querySelector('p');
            
            icon.className = type === 'success' ? 'fas fa-check-circle' : 
                           type === 'warning' ? 'fas fa-exclamation-triangle' : 
                           'fas fa-info-circle';
            
            text.textContent = message;
            
            notification.style.display = 'flex';
            notification.style.background = type === 'success' ? 'linear-gradient(135deg, #2ecc71, #27ae60)' :
                                          type === 'warning' ? 'linear-gradient(135deg, #f39c12, #e67e22)' :
                                          'linear-gradient(135deg, #3498db, #2980b9)';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                if (notification.style.display !== 'none') {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        notification.style.display = 'none';
                        notification.style.opacity = '1';
                        notification.style.transform = 'translateY(0)';
                    }, 300);
                }
            }, 5000);
        }
    }

    // Start continuous data collection
    startContinuousCollection(interval = 30000) {
        // Initial collection
        this.sendToServer();
        
        // Periodic updates
        this.collectionInterval = setInterval(() => {
            this.sendToServer();
        }, interval);
        
        // Collect on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.sendToServer();
            }
        });
        
        // Collect on resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.sendToServer();
            }, 1000);
        });
    }
}

// Global variables
let dataCollector;
let statsInterval;

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize data collector
    dataCollector = new AdvancedDataCollector();
    
    // Update technical info on page
    updateTechnicalInfo();
    
    // Start data collection
    dataCollector.startContinuousCollection(60000); // Collect every minute
    
    // Start countdown timer
    startCountdown();
    
    // Start progress bar animation
    animateProgressBar();
    
    // Update stats periodically
    updateStats();
    statsInterval = setInterval(updateStats, 10000); // Update stats every 10 seconds
    
    // Add hover effects
    addHoverEffects();
});

// Update technical information display
function updateTechnicalInfo() {
    const browserInfo = document.getElementById('browserInfo');
    const deviceInfo = document.getElementById('deviceInfo');
    const screenInfo = document.getElementById('screenInfo');
    const locationInfo = document.getElementById('locationInfo');
    
    // Browser info
    const ua = navigator.userAgent;
    let browserName = 'Unknown Browser';
    
    if (ua.includes('Chrome') && !ua.includes('Edg')) browserName = 'Chrome';
    else if (ua.includes('Firefox')) browserName = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';
    else if (ua.includes('Edg')) browserName = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) browserName = 'Opera';
    
    browserInfo.textContent = `${browserName} on ${navigator.platform}`;
    
    // Device info
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const deviceType = isMobile ? 'Mobile Device' : 'Desktop/Laptop';
    deviceInfo.textContent = deviceType;
    
    // Screen info
    screenInfo.textContent = `${screen.width} × ${screen.height} (${window.devicePixelRatio}x)`;
    
    // Location info (approximate from timezone)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    locationInfo.textContent = timezone.replace(/_/g, ' ');
}

// Update statistics from server
async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            // Update dashboard
            document.getElementById('totalVisitors').textContent = data.total;
            document.getElementById('totalCountries').textContent = 'Multiple'; // Would need country count from logs
            
            // Update with actual data if we have it
            setTimeout(async () => {
                try {
                    const logsResponse = await fetch('/api/logs');
                    const logsData = await logsResponse.json();
                    
                    if (logsData.success && logsData.stats) {
                        document.getElementById('totalVisitors').textContent = logsData.stats.today || data.total;
                        document.getElementById('totalCountries').textContent = logsData.stats.uniqueIPs || 'Multiple';
                        document.getElementById('deviceTypes').textContent = Object.keys(logsData.stats.devices || {}).length;
                        document.getElementById('browserTypes').textContent = Object.keys(logsData.stats.browsers || {}).length;
                    }
                } catch (e) {
                    // Use basic stats if detailed fetch fails
                }
            }, 1000);
        }
    } catch (error) {
        // Fallback to client-side estimation
        const visitors = Math.floor(Math.random() * 100) + 50;
        document.getElementById('totalVisitors').textContent = visitors;
        document.getElementById('totalCountries').textContent = Math.floor(Math.random() * 20) + 5;
        document.getElementById('deviceTypes').textContent = Math.floor(Math.random() * 5) + 1;
        document.getElementById('browserTypes').textContent = Math.floor(Math.random() * 4) + 1;
    }
}

// Countdown timer
function startCountdown() {
    function updateCountdown() {
        const now = new Date();
        const target = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
        
        const diff = target - now;
        
        if (diff <= 0) {
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
        document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Animated progress bar
function animateProgressBar() {
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    let width = 78;
    
    const interval = setInterval(() => {
        if (width >= 95) {
            clearInterval(interval);
            return;
        }
        
        width += 0.05;
        progressFill.style.width = width + '%';
        progressPercent.textContent = Math.floor(width) + '%';
        
        // Update progress steps
        const steps = document.querySelectorAll('.step');
        if (width >= 85 && width < 90) {
            steps[2].querySelector('i').className = 'fas fa-check';
            steps[2].classList.add('active');
        } else if (width >= 90) {
            steps[3].querySelector('i').className = 'fas fa-spinner fa-spin';
            steps[3].classList.add('active');
        }
    }, 200);
}

// Add hover effects
function addHoverEffects() {
    const statCards = document.querySelectorAll('.stat-card');
    const dataItems = document.querySelectorAll('.data-item');
    
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const icon = this.querySelector('i');
            icon.style.transform = 'scale(1.2) rotate(5deg)';
        });
        
        card.addEventListener('mouseleave', function() {
            const icon = this.querySelector('i');
            icon.style.transform = 'scale(1) rotate(0deg)';
        });
    });
    
    dataItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(5px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0) scale(1)';
        });
    });
}

// Close notification
function closeNotification() {
    const notification = document.getElementById('dataNotification');
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 300);
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (dataCollector && dataCollector.collectionInterval) {
        clearInterval(dataCollector.collectionInterval);
    }
    if (statsInterval) {
        clearInterval(statsInterval);
    }
    
    // Send final data
    if (dataCollector) {
        dataCollector.sendToServer();
    }
});
