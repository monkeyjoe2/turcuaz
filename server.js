const express = require('express');
const fs = require('fs');
const path = require('path');
const useragent = require('useragent');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const requestIp = require('request-ip');
const DeviceDetector = require('device-detector-js');
const FingerprintCollector = require('./fingerprint');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize collectors
const fingerprintCollector = new FingerprintCollector();
const deviceDetector = new DeviceDetector();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestIp.mw());
app.use(express.static('public'));

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Enhanced user data collection
function collectEnhancedUserData(req) {
    const ip = requestIp.getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    
    // Parse user agent with multiple libraries
    const parser = new UAParser();
    const uaResult = parser.setUA(userAgent).getResult();
    const agent = useragent.parse(userAgent);
    const device = deviceDetector.parse(userAgent);
    
    // Get geo location
    const geo = geoip.lookup(ip);
    
    // Collect fingerprint data
    const fingerprint = fingerprintCollector.collectAllFingerprintData(req);
    
    // Enhanced user data object
    const userData = {
        // Timestamp
        timestamp: new Date().toISOString(),
        sessionId: req.cookies.sessionId || generateSessionId(),
        
        // Network information
        network: {
            ip: ip,
            publicIp: req.ip,
            headers: {
                'x-forwarded-for': req.headers['x-forwarded-for'],
                'x-real-ip': req.headers['x-real-ip'],
                'cf-connecting-ip': req.headers['cf-connecting-ip'],
                'x-client-ip': req.headers['x-client-ip']
            },
            isp: geo ? geo.isp : null,
            organization: geo ? geo.org : null
        },
        
        // Browser information (triple verification)
        browser: {
            // UAParser results
            uaParser: {
                name: uaResult.browser.name,
                version: uaResult.browser.version,
                major: uaResult.browser.major
            },
            // Useragent results
            useragent: {
                family: agent.family,
                major: agent.major,
                minor: agent.minor,
                patch: agent.patch
            },
            // Device detector results
            deviceDetector: device.client || {},
            // Raw user agent
            raw: userAgent.substring(0, 500) // Limit length
        },
        
        // Operating System
        os: {
            uaParser: {
                name: uaResult.os.name,
                version: uaResult.os.version
            },
            useragent: {
                family: agent.os.family,
                major: agent.os.major,
                minor: agent.os.minor,
                patch: agent.os.patch
            },
            deviceDetector: device.os || {}
        },
        
        // Device information
        device: {
            type: device.device?.type || uaResult.device.type || 'desktop',
            model: device.device?.model || uaResult.device.model,
            brand: device.device?.brand || uaResult.device.vendor,
            isMobile: /mobile/i.test(userAgent),
            isTablet: /tablet/i.test(userAgent),
            isDesktop: !/mobile|tablet/i.test(userAgent),
            isBot: device.bot || false,
            botInfo: device.bot || null
        },
        
        // Engine information
        engine: {
            name: uaResult.engine.name,
            version: uaResult.engine.version
        },
        
        // CPU architecture
        cpu: {
            architecture: uaResult.cpu.architecture
        },
        
        // Screen information (from headers if available)
        screen: {
            width: req.headers['screen-width'] || req.body.screenWidth || '',
            height: req.headers['screen-height'] || req.body.screenHeight || '',
            colorDepth: req.headers['color-depth'] || req.body.colorDepth || '',
            pixelRatio: req.headers['pixel-ratio'] || req.body.pixelRatio || '',
            orientation: req.headers['orientation'] || ''
        },
        
        // Language and locale
        locale: {
            language: req.headers['accept-language'] || '',
            languages: req.acceptsLanguages() || [],
            locale: req.headers['accept-locale'] || ''
        },
        
        // Connection information
        connection: {
            remoteAddress: req.connection.remoteAddress,
            remotePort: req.connection.remotePort,
            localAddress: req.connection.localAddress,
            localPort: req.connection.localPort,
            encrypted: req.secure
        },
        
        // Geographic location
        geo: geo ? {
            country: geo.country,
            region: geo.region,
            city: geo.city,
            ll: geo.ll,
            timezone: geo.timezone,
            metro: geo.metro,
            range: geo.range,
            isp: geo.isp,
            org: geo.org,
            as: geo.as
        } : null,
        
        // Request details
        request: {
            method: req.method,
            url: req.url,
            protocol: req.protocol,
            secure: req.secure,
            hostname: req.hostname,
            subdomains: req.subdomains,
            originalUrl: req.originalUrl,
            path: req.path,
            query: req.query,
            params: req.params,
            cookies: req.cookies,
            signedCookies: req.signedCookies,
            fresh: req.fresh,
            stale: req.stale,
            xhr: req.xhr
        },
        
        // Headers (excluding sensitive ones)
        headers: {
            host: req.headers.host,
            connection: req.headers.connection,
            'cache-control': req.headers['cache-control'],
            'upgrade-insecure-requests': req.headers['upgrade-insecure-requests'],
            'sec-fetch-site': req.headers['sec-fetch-site'],
            'sec-fetch-mode': req.headers['sec-fetch-mode'],
            'sec-fetch-user': req.headers['sec-fetch-user'],
            'sec-fetch-dest': req.headers['sec-fetch-dest'],
            referer: req.headers.referer,
            dnt: req.headers.dnt
        },
        
        // Fingerprint data
        fingerprint: fingerprint,
        
        // Performance metrics (if sent from client)
        performance: req.body.performance || null,
        
        // Storage information (if available)
        storage: {
            localStorage: req.body.localStorage || false,
            sessionStorage: req.body.sessionStorage || false,
            indexedDB: req.body.indexedDB || false,
            cookiesEnabled: req.body.cookiesEnabled || false
        },
        
        // WebRTC IP (if leaked by client)
        webRTC: req.body.webRTC || null,
        
        // Battery API (if available)
        battery: req.body.battery || null,
        
        // Media devices (if available)
        mediaDevices: req.body.mediaDevices || null
    };

    return userData;
}

// Generate session ID
function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save user data to file
function saveUserData(userData) {
    const logFile = path.join(dataDir, 'logs.json');
    let logs = [];
    
    try {
        if (fs.existsSync(logFile)) {
            const data = fs.readFileSync(logFile, 'utf8');
            logs = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading log file:', err);
    }

    logs.push(userData);

    try {
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        console.log(`[${new Date().toISOString()}] Collected data from IP: ${userData.network.ip}`);
        
        // Also log to CSV for easier analysis
        logToCSV(userData);
    } catch (err) {
        console.error('Error writing log file:', err);
    }
}

// Log to CSV for spreadsheet analysis
function logToCSV(userData) {
    const csvFile = path.join(dataDir, 'logs.csv');
    const headers = [
        'timestamp', 'ip', 'country', 'city', 'browser', 'browser_version',
        'os', 'os_version', 'device_type', 'device_model', 'screen',
        'language', 'timezone', 'is_mobile', 'is_bot', 'session_id'
    ];
    
    const row = [
        userData.timestamp,
        userData.network.ip,
        userData.geo?.country || 'Unknown',
        userData.geo?.city || 'Unknown',
        userData.browser.uaParser.name || 'Unknown',
        userData.browser.uaParser.version || 'Unknown',
        userData.os.uaParser.name || 'Unknown',
        userData.os.uaParser.version || 'Unknown',
        userData.device.type || 'Unknown',
        userData.device.model || 'Unknown',
        `${userData.screen.width}x${userData.screen.height}`,
        userData.locale.language?.split(',')[0] || 'Unknown',
        userData.geo?.timezone || 'Unknown',
        userData.device.isMobile ? 'Yes' : 'No',
        userData.device.isBot ? 'Yes' : 'No',
        userData.sessionId
    ].map(field => `"${field}"`).join(',');
    
    try {
        if (!fs.existsSync(csvFile)) {
            fs.writeFileSync(csvFile, headers.join(',') + '\n');
        }
        fs.appendFileSync(csvFile, row + '\n');
    } catch (err) {
        console.error('Error writing CSV:', err);
    }
}

// API endpoint to receive client-side data
app.post('/api/collect', (req, res) => {
    try {
        const userData = collectEnhancedUserData(req);
        
        // Merge client-side data
        if (req.body.clientData) {
            userData.clientData = req.body.clientData;
        }
        
        saveUserData(userData);
        
        res.json({
            success: true,
            message: 'Data collected successfully',
            sessionId: userData.sessionId,
            timestamp: userData.timestamp
        });
    } catch (error) {
        console.error('Error collecting data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to collect data'
        });
    }
});

// Serve maintenance page
app.get('/', (req, res) => {
    // Set session cookie if not present
    if (!req.cookies.sessionId) {
        const sessionId = generateSessionId();
        res.cookie('sessionId', sessionId, {
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            httpOnly: true
        });
    }
    
    // Collect basic data
    const userData = collectEnhancedUserData(req);
    saveUserData(userData);
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API to get collected data
app.get('/api/logs', (req, res) => {
    try {
        const logFile = path.join(dataDir, 'logs.json');
        const csvFile = path.join(dataDir, 'logs.csv');
        
        if (fs.existsSync(logFile)) {
            const data = fs.readFileSync(logFile, 'utf8');
            const logs = JSON.parse(data);
            
            // Statistics
            const stats = {
                total: logs.length,
                uniqueIPs: [...new Set(logs.map(log => log.network.ip))].length,
                browsers: {},
                devices: {},
                countries: {},
                os: {},
                today: logs.filter(log => {
                    const logDate = new Date(log.timestamp);
                    const today = new Date();
                    return logDate.toDateString() === today.toDateString();
                }).length
            };
            
            logs.forEach(log => {
                // Browser stats
                const browser = log.browser.uaParser.name || 'Unknown';
                stats.browsers[browser] = (stats.browsers[browser] || 0) + 1;
                
                // Device stats
                const deviceType = log.device.type || 'desktop';
                stats.devices[deviceType] = (stats.devices[deviceType] || 0) + 1;
                
                // Country stats
                const country = log.geo?.country || 'Unknown';
                stats.countries[country] = (stats.countries[country] || 0) + 1;
                
                // OS stats
                const os = log.os.uaParser.name || 'Unknown';
                stats.os[os] = (stats.os[os] || 0) + 1;
            });
            
            res.json({
                success: true,
                stats: stats,
                total: logs.length,
                logs: logs.slice(-50).reverse() // Last 50 entries
            });
        } else {
            res.json({
                success: true,
                stats: {},
                total: 0,
                logs: []
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Failed to read logs'
        });
    }
});

// API to get statistics
app.get('/api/stats', (req, res) => {
    try {
        const logFile = path.join(dataDir, 'logs.json');
        
        if (fs.existsSync(logFile)) {
            const data = fs.readFileSync(logFile, 'utf8');
            const logs = JSON.parse(data);
            
            const hourlyData = {};
            logs.forEach(log => {
                const hour = new Date(log.timestamp).toISOString().slice(0, 13) + ':00';
                hourlyData[hour] = (hourlyData[hour] || 0) + 1;
            });
            
            res.json({
                success: true,
                hourlyData: hourlyData,
                total: logs.length
            });
        } else {
            res.json({
                success: true,
                hourlyData: {},
                total: 0
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Failed to read stats'
        });
    }
});

// API to clear logs
app.delete('/api/logs', (req, res) => {
    try {
        const logFile = path.join(dataDir, 'logs.json');
        const csvFile = path.join(dataDir, 'logs.csv');
        
        fs.writeFileSync(logFile, JSON.stringify([], null, 2));
        if (fs.existsSync(csvFile)) {
            fs.unlinkSync(csvFile);
        }
        
        res.json({
            success: true,
            message: 'Logs cleared successfully'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Failed to clear logs'
        });
    }
});

// Download logs as CSV
app.get('/api/logs/csv', (req, res) => {
    try {
        const csvFile = path.join(dataDir, 'logs.csv');
        
        if (fs.existsSync(csvFile)) {
            res.download(csvFile, 'user_logs.csv');
        } else {
            res.status(404).json({
                success: false,
                error: 'No CSV data available'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Failed to download CSV'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 User data being logged to ${dataDir}/`);
    console.log(`📈 View stats at http://localhost:${PORT}/api/stats`);
    console.log(`📁 View logs at http://localhost:${PORT}/api/logs`);
});
