const express = require('express');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const requestIp = require('request-ip');

const app = express();
const PORT = process.env.PORT || 3000;

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
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Other middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestIp.mw());
app.use(express.static('public'));

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Enhanced user data collection
function collectEnhancedUserData(req) {
    const ip = requestIp.getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    
    // Parse user agent
    const parser = new UAParser();
    const uaResult = parser.setUA(userAgent).getResult();
    
    // Get geo location
    const geo = geoip.lookup(ip);
    
    // Enhanced user data object
    const userData = {
        timestamp: new Date().toISOString(),
        sessionId: req.cookies.sessionId || generateSessionId(),
        
        network: {
            ip: ip,
            headers: {
                'x-forwarded-for': req.headers['x-forwarded-for'],
                'x-real-ip': req.headers['x-real-ip'],
                'cf-connecting-ip': req.headers['cf-connecting-ip']
            },
            isp: geo ? geo.isp : null,
            organization: geo ? geo.org : null
        },
        
        browser: {
            name: uaResult.browser.name,
            version: uaResult.browser.version,
            major: uaResult.browser.major,
            raw: userAgent.substring(0, 500)
        },
        
        os: {
            name: uaResult.os.name,
            version: uaResult.os.version
        },
        
        device: {
            type: uaResult.device.type || 'desktop',
            model: uaResult.device.model,
            vendor: uaResult.device.vendor,
            isMobile: /mobile/i.test(userAgent),
            isTablet: /tablet/i.test(userAgent),
            isDesktop: !/mobile|tablet/i.test(userAgent)
        },
        
        engine: {
            name: uaResult.engine.name,
            version: uaResult.engine.version
        },
        
        cpu: {
            architecture: uaResult.cpu.architecture
        },
        
        screen: {
            width: req.headers['screen-width'] || req.body.screenWidth || '',
            height: req.headers['screen-height'] || req.body.screenHeight || ''
        },
        
        locale: {
            language: req.headers['accept-language'] || '',
            languages: req.acceptsLanguages() || []
        },
        
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
        
        request: {
            method: req.method,
            url: req.url,
            protocol: req.protocol,
            secure: req.secure,
            hostname: req.hostname
        },
        
        headers: {
            host: req.headers.host,
            connection: req.headers.connection,
            'cache-control': req.headers['cache-control'],
            'sec-fetch-site': req.headers['sec-fetch-site'],
            'sec-fetch-mode': req.headers['sec-fetch-mode'],
            'sec-fetch-dest': req.headers['sec-fetch-dest'],
            referer: req.headers.referer,
            dnt: req.headers.dnt
        }
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
        'os', 'os_version', 'device_type', 'screen', 'language', 'timezone'
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
        userData.geo?.timezone || 'Unknown'
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
                }).length
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
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
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    🚀 Server running on http://localhost:${PORT}
    📊 User data being logged to ${dataDir}/
    📈 View stats at http://localhost:${PORT}/api/stats
    📁 View logs at http://localhost:${PORT}/api/logs
    🏥 Health check at http://localhost:${PORT}/health
    `);
});
