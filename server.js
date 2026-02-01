const express = require('express');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Express to trust proxies
app.set('trust proxy', true);

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

// Other middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Helper function to check if IP is localhost
function isLocalhost(ip) {
    if (!ip) return true;
    
    // Clean the IP
    ip = ip.trim();
    
    // Remove IPv6 prefix if present
    ip = ip.replace('::ffff:', '');
    
    const localIPs = ['127.0.0.1', '::1', 'localhost'];
    const privateIPRanges = [
        '192.168.',
        '10.',
        '172.16.',
        '172.17.',
        '172.18.',
        '172.19.',
        '172.20.',
        '172.21.',
        '172.22.',
        '172.23.',
        '172.24.',
        '172.25.',
        '172.26.',
        '172.27.',
        '172.28.',
        '172.29.',
        '172.30.',
        '172.31.'
    ];
    
    if (localIPs.includes(ip)) return true;
    
    // Check private IP ranges
    for (const range of privateIPRanges) {
        if (ip.startsWith(range)) return true;
    }
    
    return false;
}

// Get client IP with proxy support
function getClientIP(req) {
    // Priority order for IP detection
    const sources = [
        // Cloudflare
        req.headers['cf-connecting-ip'],
        // Standard proxy headers
        req.headers['x-real-ip'],
        req.headers['x-forwarded-for'],
        req.headers['forwarded'],
        // Express properties
        req.ip,
        // Connection properties
        req.socket.remoteAddress,
        req.connection.remoteAddress
    ];
    
    for (const source of sources) {
        if (source) {
            let ip = source.toString().trim();
            
            // Handle x-forwarded-for format: "client, proxy1, proxy2"
            if (source.includes(',')) {
                const ips = source.split(',').map(ip => ip.trim());
                // First IP in x-forwarded-for is the client
                ip = ips[0];
            }
            
            // Handle forwarded header format: "for=192.0.2.43;proto=http;by=203.0.113.43"
            if (source.includes('for=')) {
                const match = source.match(/for=([^;]+)/);
                if (match && match[1]) {
                    ip = match[1].trim();
                }
            }
            
            // Remove IPv6 prefix if present
            ip = ip.replace('::ffff:', '');
            
            // Clean up
            ip = ip.trim();
            
            if (ip && ip !== '::1' && ip !== '127.0.0.1') {
                return ip;
            }
        }
    }
    
    return '127.0.0.1'; // Fallback to localhost
}

// Enhanced user data collection
function collectEnhancedUserData(req) {
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const isLocal = isLocalhost(clientIP);
    
    // Parse user agent
    const parser = new UAParser();
    const uaResult = parser.setUA(userAgent).getResult();
    
    // Get geo location (handle localhost specially)
    let geo = geoip.lookup(clientIP);
    
    if (isLocal && !geo) {
        // Create dummy geo data for localhost for testing
        geo = {
            country: 'Localhost',
            region: 'Development',
            city: 'Local Machine',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            ll: [0, 0],
            metro: 0,
            range: [clientIP, clientIP],
            isp: 'Local Network',
            org: 'Development Environment'
        };
    }
    
    // Enhanced user data object
    const userData = {
        timestamp: new Date().toISOString(),
        sessionId: req.cookies.sessionId || generateSessionId(),
        isLocalhost: isLocal,
        
        network: {
            ip: clientIP,
            isLocalhost: isLocal,
            headers: {
                'x-forwarded-for': req.headers['x-forwarded-for'] || null,
                'x-real-ip': req.headers['x-real-ip'] || null,
                'cf-connecting-ip': req.headers['cf-connecting-ip'] || null,
                'forwarded': req.headers['forwarded'] || null
            },
            isp: geo ? geo.isp : null,
            organization: geo ? geo.org : null
        },
        
        browser: {
            name: uaResult.browser.name || 'Unknown',
            version: uaResult.browser.version || 'Unknown',
            major: uaResult.browser.major || 'Unknown',
            raw: userAgent.substring(0, 500)
        },
        
        os: {
            name: uaResult.os.name || 'Unknown',
            version: uaResult.os.version || 'Unknown'
        },
        
        device: {
            type: uaResult.device.type || 'desktop',
            model: uaResult.device.model || 'Unknown',
            vendor: uaResult.device.vendor || 'Unknown',
            isMobile: /mobile/i.test(userAgent),
            isTablet: /tablet/i.test(userAgent),
            isDesktop: !/mobile|tablet/i.test(userAgent)
        },
        
        engine: {
            name: uaResult.engine.name || 'Unknown',
            version: uaResult.engine.version || 'Unknown'
        },
        
        cpu: {
            architecture: uaResult.cpu.architecture || 'Unknown'
        },
        
        screen: {
            width: req.headers['screen-width'] || req.body.screenWidth || '',
            height: req.headers['screen-height'] || req.body.screenHeight || ''
        },
        
        locale: {
            language: req.headers['accept-language'] || 'Unknown',
            languages: req.acceptsLanguages() || []
        },
        
        geo: geo ? {
            country: geo.country || 'Unknown',
            region: geo.region || 'Unknown',
            city: geo.city || 'Unknown',
            ll: geo.ll || [0, 0],
            timezone: geo.timezone || 'UTC',
            metro: geo.metro || 0,
            range: geo.range || [clientIP, clientIP],
            isp: geo.isp || 'Unknown',
            org: geo.org || 'Unknown',
            as: geo.as || 'Unknown'
        } : null,
        
        request: {
            method: req.method,
            url: req.url,
            protocol: req.protocol,
            secure: req.secure,
            hostname: req.hostname,
            originalUrl: req.originalUrl,
            path: req.path,
            query: req.query || {}
        },
        
        headers: {
            host: req.headers.host || 'Unknown',
            connection: req.headers.connection || 'Unknown',
            'cache-control': req.headers['cache-control'] || 'Unknown',
            'sec-fetch-site': req.headers['sec-fetch-site'] || 'Unknown',
            'sec-fetch-mode': req.headers['sec-fetch-mode'] || 'Unknown',
            'sec-fetch-dest': req.headers['sec-fetch-dest'] || 'Unknown',
            referer: req.headers.referer || 'No referer',
            dnt: req.headers.dnt || 'Not specified'
        }
    };

    return userData;
}

// Generate session ID
function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save user data to file with better error handling
function saveUserData(userData) {
    const logFile = path.join(dataDir, 'logs.json');
    let logs = [];
    
    try {
        if (fs.existsSync(logFile)) {
            const data = fs.readFileSync(logFile, 'utf8');
            if (data.trim()) {
                logs = JSON.parse(data);
            }
        }
    } catch (err) {
        console.error('Error reading log file:', err);
        // Create fresh logs array if file is corrupted
        logs = [];
    }

    logs.push(userData);

    try {
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        console.log(`✅ [${new Date().toISOString()}] Collected data from IP: ${userData.network.ip}`);
        console.log(`   Browser: ${userData.browser.name} ${userData.browser.version}`);
        console.log(`   OS: ${userData.os.name} ${userData.os.version}`);
        console.log(`   Device: ${userData.device.type}`);
        console.log(`   Country: ${userData.geo?.country || 'Unknown'}`);
        
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
        'os', 'os_version', 'device_type', 'screen', 'language', 'timezone', 'is_localhost'
    ];
    
    const row = [
        userData.timestamp,
        userData.network.ip,
        userData.geo?.country || 'Unknown',
        userData.geo?.city || 'Unknown',
        userData.browser.name || 'Unknown',
        userData.browser.version || 'Unknown',
        userData.os.name || 'Unknown',
        userData.os.version || 'Unknown',
        userData.device.type || 'Unknown',
        `${userData.screen.width}x${userData.screen.height}`,
        userData.locale.language?.split(',')[0] || 'Unknown',
        userData.geo?.timezone || 'Unknown',
        userData.isLocalhost ? 'Yes' : 'No'
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
        
        // Merge client-side data if provided
        if (req.body.clientData) {
            userData.clientData = req.body.clientData;
        }
        
        saveUserData(userData);
        
        res.json({
            success: true,
            message: 'Data collected successfully',
            sessionId: userData.sessionId,
            timestamp: userData.timestamp,
            ip: userData.network.ip,
            isLocalhost: userData.isLocalhost
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
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
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
                }).length,
                localhostVisits: logs.filter(log => log.isLocalhost).length
            };
            
            logs.forEach(log => {
                // Browser stats
                const browser = log.browser.name || 'Unknown';
                stats.browsers[browser] = (stats.browsers[browser] || 0) + 1;
                
                // Device stats
                const deviceType = log.device.type || 'desktop';
                stats.devices[deviceType] = (stats.devices[deviceType] || 0) + 1;
                
                // Country stats
                const country = log.geo?.country || 'Unknown';
                stats.countries[country] = (stats.countries[country] || 0) + 1;
                
                // OS stats
                const os = log.os.name || 'Unknown';
                stats.os[os] = (stats.os[os] || 0) + 1;
            });
            
            res.json({
                success: true,
                stats: stats,
                total: logs.length,
                logs: logs.slice(-50).reverse()
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
            
            // Get unique visitors by IP
            const uniqueIPs = [...new Set(logs.map(log => log.network.ip))];
            
            res.json({
                success: true,
                hourlyData: hourlyData,
                total: logs.length,
                uniqueVisitors: uniqueIPs.length,
                localhostVisits: logs.filter(log => log.isLocalhost).length,
                recentVisits: logs.slice(-10).map(log => ({
                    time: log.timestamp,
                    ip: log.network.ip,
                    browser: log.browser.name,
                    country: log.geo?.country
                }))
            });
        } else {
            res.json({
                success: true,
                hourlyData: {},
                total: 0,
                uniqueVisitors: 0,
                localhostVisits: 0,
                recentVisits: []
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
    });
});

// Debug endpoint to see what headers are being received
app.get('/api/debug', (req, res) => {
    const clientIP = getClientIP(req);
    
    res.json({
        success: true,
        clientIP: clientIP,
        isLocalhost: isLocalhost(clientIP),
        headers: {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            'cf-connecting-ip': req.headers['cf-connecting-ip'],
            'forwarded': req.headers['forwarded'],
            'host': req.headers.host
        },
        connection: {
            remoteAddress: req.connection.remoteAddress,
            socketRemoteAddress: req.socket.remoteAddress,
            ip: req.ip
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    🚀 Server running on http://localhost:${PORT}
    📊 User data being logged to ${dataDir}/
    📈 View stats at http://localhost:${PORT}/api/stats
    📁 View logs at http://localhost:${PORT}/api/logs
    🐛 Debug info at http://localhost:${PORT}/api/debug
    🏥 Health check at http://localhost:${PORT}/health
    `);
});
