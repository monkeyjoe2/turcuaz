// Advanced client-side data collection
class AdvancedDataCollector {
    constructor() {
        this.sessionId = this.getSessionId();
        this.startTime = Date.now();
        this.collectedData = {};
    }

    getSessionId() {
        let sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    // Detect ad/tracker blockers
    detectAdBlockers() {
        const blockers = {
            adBlock: false,
            privacyBadger: false,
            uBlock: false,
            ghostery: false,
            scriptBlockers: []
        };
        
        // Test for ad blockers by checking if ads are blocked
        const testAd = document.createElement('div');
        testAd.innerHTML = '&nbsp;';
        testAd.className = 'adsbox';
        testAd.style.position = 'absolute';
        testAd.style.left = '-999px';
        testAd.style.top = '-999px';
        document.body.appendChild(testAd);
        
        setTimeout(() => {
            const isBlocked = testAd.offsetHeight === 0;
            blockers.adBlock = isBlocked;
            document.body.removeChild(testAd);
        }, 100);
        
        // Check for common blocker scripts
        const scripts = Array.from(document.scripts).map(s => s.src);
        blockers.scriptBlockers = scripts.filter(src => 
            src.includes('adblock') || 
            src.includes('ublock') || 
            src.includes('ghostery') ||
            src.includes('privacy-badger')
        );
        
        return blockers;
    }

    // Detect incognito mode
    async detectIncognito() {
        const methods = {
            fileSystemQuota: false,
            storageQuota: false,
            serviceWorker: false
        };
        
        // Method 1: FileSystem API quota
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const { quota } = await navigator.storage.estimate();
                methods.fileSystemQuota = quota < 120000000; // Incognito has lower quota
            } catch (e) {}
        }
        
        // Method 2: Service worker registration
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                await registration.unregister();
                methods.serviceWorker = false; // If it worked, not incognito
            } catch (e) {
                methods.serviceWorker = true; // Failed, might be incognito
            }
        }
        
        return {
            isIncognito: methods.fileSystemQuota || methods.serviceWorker,
            evidence: methods
        };
    }

    // Get WebRTC IP leak
    async getWebRTCIP() {
        return new Promise((resolve) => {
            const RTCPeerConnection = window.RTCPeerConnection || 
                                     window.mozRTCPeerConnection || 
                                     window.webkitRTCPeerConnection;
            
            if (!RTCPeerConnection) {
                resolve([]);
                return;
            }
            
            const pc = new RTCPeerConnection({ iceServers: [] });
            const ips = [];
            
            pc.createDataChannel('');
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(() => resolve([]));
            
            pc.onicecandidate = (event) => {
                if (!event || !event.candidate) {
                    pc.close();
                    resolve(ips);
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
            
            setTimeout(() => {
                pc.close();
                resolve(ips);
            }, 1000);
        });
    }

    // Get DNS/TCP timings from Performance API
    getNetworkTimings() {
        if (!performance || !performance.timing) return null;
        
        const timing = performance.timing;
        return {
            dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
            tcpConnect: timing.connectEnd - timing.connectStart,
            sslHandshake: timing.secureConnectionStart > 0 ? 
                timing.connectEnd - timing.secureConnectionStart : 0,
            request: timing.responseStart - timing.requestStart,
            response: timing.responseEnd - timing.responseStart,
            domInteractive: timing.domInteractive - timing.navigationStart,
            domComplete: timing.domComplete - timing.navigationStart,
            loadEvent: timing.loadEventEnd - timing.loadEventStart
        };
    }

    // Detect multi-monitor setup
    detectMultiMonitor() {
        return {
            screenX: window.screenX,
            screenY: window.screenY,
            screenLeft: window.screenLeft,
            screenTop: window.screenTop,
            screenAvailLeft: window.screen.availLeft,
            screenAvailTop: window.screen.availTop,
            isMultiMonitor: window.screenX > 0 || window.screenY > 0 || 
                           window.screen.availLeft > 0 || window.screen.availTop > 0
        };
    }

    // Get locale settings
    getLocaleSettings() {
        const formatter = new Intl.DateTimeFormat();
        const options = formatter.resolvedOptions();
        
        return {
            timezone: options.timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            locale: options.locale,
            language: navigator.language,
            languages: navigator.languages,
            region: options.locale.split('-')[1] || 'Unknown',
            currency: Intl.NumberFormat().resolvedOptions().currency || 'Unknown',
            numberingSystem: options.numberingSystem,
            calendar: options.calendar
        };
    }

    // Get exact browser version
    getExactBrowserVersion() {
        const ua = navigator.userAgent;
        let version = '';
        
        // Chrome/Chromium
        if (/Chrome\/([0-9.]+)/.test(ua)) {
            version = ua.match(/Chrome\/([0-9.]+)/)[1];
        }
        // Firefox
        else if (/Firefox\/([0-9.]+)/.test(ua)) {
            version = ua.match(/Firefox\/([0-9.]+)/)[1];
        }
        // Safari
        else if (/Version\/([0-9.]+)/.test(ua)) {
            version = ua.match(/Version\/([0-9.]+)/)[1];
        }
        // Edge
        else if (/Edg\/([0-9.]+)/.test(ua)) {
            version = ua.match(/Edg\/([0-9.]+)/)[1];
        }
        
        return version;
    }

    // Get OS build/architecture details
    getOSDetails() {
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        
        return {
            platform: platform,
            oscpu: navigator.oscpu || 'Unknown',
            product: navigator.product,
            productSub: navigator.productSub,
            vendor: navigator.vendor,
            architecture: this.detectArchitecture(ua),
            buildInfo: this.extractOSBuild(ua)
        };
    }

    detectArchitecture(ua) {
        if (/Win64|x64|WOW64|x86_64/.test(ua)) return 'x64';
        if (/Win32|x86/.test(ua)) return 'x86';
        if (/arm64|aarch64/.test(ua)) return 'arm64';
        if (/arm/.test(ua)) return 'arm';
        return 'Unknown';
    }

    extractOSBuild(ua) {
        // Extract Windows build number
        const winMatch = ua.match(/Windows NT (\d+\.\d+)(?:\.(\d+))?/);
        if (winMatch) {
            return `Windows ${winMatch[1]}${winMatch[2] ? ` Build ${winMatch[2]}` : ''}`;
        }
        
        // Extract macOS version
        const macMatch = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
        if (macMatch) {
            return `macOS ${macMatch[1].replace(/_/g, '.')}`;
        }
        
        // Extract Linux distribution
        if (/Linux/.test(ua)) {
            return 'Linux';
        }
        
        return 'Unknown';
    }

    // Get tab history length
    getTabHistory() {
        return {
            historyLength: window.history.length,
            referrer: document.referrer,
            navigationType: performance.navigation?.type || 0,
            redirectCount: performance.navigation?.redirectCount || 0
        };
    }

    // Collect all data
    async collectAllData() {
        // Collect synchronous data immediately
        const immediateData = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            timeOnSite: Date.now() - this.startTime,
            
            screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelRatio: window.devicePixelRatio,
                multiMonitor: this.detectMultiMonitor()
            },
            
            browser: {
                userAgent: navigator.userAgent,
                exactVersion: this.getExactBrowserVersion(),
                platform: navigator.platform,
                language: navigator.language,
                languages: navigator.languages,
                cookieEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack,
                onLine: navigator.onLine,
                hardwareConcurrency: navigator.hardwareConcurrency,
                deviceMemory: navigator.deviceMemory,
                maxTouchPoints: navigator.maxTouchPoints,
                pdfViewerEnabled: navigator.pdfViewerEnabled || false
            },
            
            os: this.getOSDetails(),
            
            performance: {
                timing: this.getNetworkTimings(),
                memory: performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                } : null,
                navigation: {
                    type: performance.navigation?.type,
                    redirectCount: performance.navigation?.redirectCount
                }
            },
            
            network: {
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    rtt: navigator.connection.rtt,
                    downlink: navigator.connection.downlink,
                    saveData: navigator.connection.saveData
                } : null
            },
            
            locale: this.getLocaleSettings(),
            
            tabHistory: this.getTabHistory(),
            
            adBlockers: this.detectAdBlockers()
        };

        // Collect async data
        try {
            const [webRTCIP, incognito] = await Promise.all([
                this.getWebRTCIP(),
                this.detectIncognito()
            ]);
            
            immediateData.webRTC = webRTCIP;
            immediateData.incognito = incognito;
        } catch (e) {
            immediateData.webRTC = [];
            immediateData.incognito = { isIncognito: false, evidence: {} };
        }

        this.collectedData = immediateData;
        return immediateData;
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
                    'Device-Memory': data.browser.deviceMemory || '',
                    'Hardware-Concurrency': data.browser.hardwareConcurrency || '',
                    'Accept-Language': data.browser.language
                },
                body: JSON.stringify({
                    extendedData: data
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update UI
                this.updateUI(result);
                return result;
            }
        } catch (error) {
            console.log('Data collection completed');
        }
    }

    updateUI(result) {
        document.getElementById('sessionId').textContent = result.sessionId || this.sessionId;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        
        // Update technical info
        const browserInfo = document.getElementById('browserInfo');
        const deviceInfo = document.getElementById('deviceInfo');
        const screenInfo = document.getElementById('screenInfo');
        const locationInfo = document.getElementById('locationInfo');
        
        if (browserInfo) {
            browserInfo.textContent = `${this.collectedData.browser.exactVersion || 'Browser'} on ${this.collectedData.os.platform}`;
        }
        
        if (deviceInfo) {
            const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            deviceInfo.textContent = isMobile ? 'Mobile Device' : 'Desktop/Laptop';
        }
        
        if (screenInfo) {
            screenInfo.textContent = `${this.collectedData.screen.width} × ${this.collectedData.screen.height} (${this.collectedData.screen.pixelRatio}x)`;
        }
        
        if (locationInfo) {
            locationInfo.textContent = this.collectedData.locale.timezone.replace(/_/g, ' ');
        }
    }

    // Start immediate data collection
    start() {
        // Send data immediately on load
        window.addEventListener('load', () => {
            setTimeout(() => this.sendToServer(), 100);
        });
        
        // Send on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.sendToServer();
            }
        });
        
        // Send on beforeunload
        window.addEventListener('beforeunload', () => {
            // Use sendBeacon for reliable unload sending
            const data = JSON.stringify(this.collectedData);
            navigator.sendBeacon('/api/collect', data);
        });
    }
}

// Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    // Initialize data collector
    const dataCollector = new AdvancedDataCollector();
    dataCollector.start();
    
    // Start countdown timer
    startCountdown();
    
    // Start progress bar animation
    animateProgressBar();
    
    // Update stats periodically
    updateStats();
    setInterval(updateStats, 10000);
});

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
        
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Animated progress bar
function animateProgressBar() {
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    if (!progressFill || !progressPercent) return;
    
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

// Update statistics from server
async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const totalVisitors = document.getElementById('totalVisitors');
            const totalCountries = document.getElementById('totalCountries');
            const deviceTypes = document.getElementById('deviceTypes');
            const browserTypes = document.getElementById('browserTypes');
            
            if (totalVisitors) totalVisitors.textContent = data.total || '0';
            if (totalCountries) totalCountries.textContent = data.uniqueVisitors || '0';
            if (deviceTypes) deviceTypes.textContent = '3'; // Default
            if (browserTypes) browserTypes.textContent = '4'; // Default
        }
    } catch (error) {
        // Fallback values
        const elements = {
            totalVisitors: '85',
            totalCountries: '12',
            deviceTypes: '3',
            browserTypes: '4'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }
}
