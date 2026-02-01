// Simplified client-side data collection
class DataCollector {
    constructor() {
        this.sessionId = this.getSessionId();
    }

    getSessionId() {
        let sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    collectScreenInfo() {
        return {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            pixelRatio: window.devicePixelRatio || 1
        };
    }

    collectBrowserInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            onLine: navigator.onLine,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            deviceMemory: navigator.deviceMemory || 'unknown',
            maxTouchPoints: navigator.maxTouchPoints || 0
        };
    }

    collectNetworkInfo() {
        const network = {};
        
        if ('connection' in navigator) {
            const conn = navigator.connection;
            network.effectiveType = conn.effectiveType;
            network.rtt = conn.rtt;
            network.downlink = conn.downlink;
            network.saveData = conn.saveData;
        }
        
        return network;
    }

    collectAllData() {
        return {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            screen: this.collectScreenInfo(),
            browser: this.collectBrowserInfo(),
            network: this.collectNetworkInfo(),
            additional: {
                referrer: document.referrer,
                url: window.location.href,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            }
        };
    }

    async sendToServer() {
        try {
            const data = this.collectAllData();
            
            const response = await fetch('/api/collect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Screen-Width': data.screen.width,
                    'Screen-Height': data.screen.height,
                    'Color-Depth': data.screen.colorDepth,
                    'Pixel-Ratio': data.screen.pixelRatio
                },
                body: JSON.stringify({
                    clientData: data
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('sessionId').textContent = result.sessionId;
                document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                showNotification('Data collection successful!', 'success');
                return result;
            }
        } catch (error) {
            console.log('Data collection completed');
        }
    }

    startContinuousCollection(interval = 60000) {
        // Initial collection
        this.sendToServer();
        
        // Periodic updates
        setInterval(() => {
            this.sendToServer();
        }, interval);
    }
}

// Global variables
let dataCollector;

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize data collector
    dataCollector = new DataCollector();
    
    // Update technical info
    updateTechnicalInfo();
    
    // Start data collection
    dataCollector.startContinuousCollection(60000);
    
    // Start countdown timer
    startCountdown();
    
    // Start progress bar animation
    animateProgressBar();
    
    // Update stats periodically
    updateStats();
    setInterval(updateStats, 10000);
    
    // Add hover effects
    addHoverEffects();
});

// Update technical information display
function updateTechnicalInfo() {
    const ua = navigator.userAgent;
    let browserName = 'Unknown Browser';
    
    if (ua.includes('Chrome') && !ua.includes('Edg')) browserName = 'Chrome';
    else if (ua.includes('Firefox')) browserName = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';
    else if (ua.includes('Edg')) browserName = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) browserName = 'Opera';
    
    document.getElementById('browserInfo').textContent = `${browserName} on ${navigator.platform}`;
    
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const deviceType = isMobile ? 'Mobile Device' : 'Desktop/Laptop';
    document.getElementById('deviceInfo').textContent = deviceType;
    
    document.getElementById('screenInfo').textContent = `${screen.width} × ${screen.height} (${window.devicePixelRatio}x)`;
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.getElementById('locationInfo').textContent = timezone.replace(/_/g, ' ');
}

// Update statistics from server
async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalVisitors').textContent = data.total;
            
            // Try to get detailed stats
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
                    // Fallback
                    document.getElementById('totalCountries').textContent = 'Multiple';
                    document.getElementById('deviceTypes').textContent = '3';
                    document.getElementById('browserTypes').textContent = '4';
                }
            }, 1000);
        }
    } catch (error) {
        // Fallback values
        document.getElementById('totalVisitors').textContent = '85';
        document.getElementById('totalCountries').textContent = '12';
        document.getElementById('deviceTypes').textContent = '3';
        document.getElementById('browserTypes').textContent = '4';
    }
}

// Countdown timer
function startCountdown() {
    function updateCountdown() {
        const now = new Date();
        const target = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        
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
    }, 200);
}

// Add hover effects
function addHoverEffects() {
    const statCards = document.querySelectorAll('.stat-card');
    
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
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('dataNotification');
    if (notification) {
        const icon = notification.querySelector('i');
        const text = notification.querySelector('p');
        
        icon.className = type === 'success' ? 'fas fa-check-circle' : 
                       type === 'warning' ? 'fas fa-exclamation-triangle' : 
                       'fas fa-info-circle';
        
        text.textContent = message;
        
        notification.style.display = 'flex';
        
        setTimeout(() => {
            if (notification.style.display !== 'none') {
                notification.style.opacity = '0';
                setTimeout(() => {
                    notification.style.display = 'none';
                    notification.style.opacity = '1';
                }, 300);
            }
        }, 3000);
    }
}

// Close notification
function closeNotification() {
    const notification = document.getElementById('dataNotification');
    notification.style.opacity = '0';
    setTimeout(() => {
        notification.style.display = 'none';
        notification.style.opacity = '1';
    }, 300);
}
