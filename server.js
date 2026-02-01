const express = require('express');
const fs = require('fs');
const path = require('path');
const useragent = require('useragent');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and serve static files
app.use(express.json());
app.use(express.static('public'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Helper function to log user data
function logUserData(req) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || '';
    
    // Parse user agent
    const parser = new UAParser();
    const uaResult = parser.setUA(userAgent).getResult();
    
    // Get geo location from IP
    const geo = geoip.lookup(ip);
    
    // Parse user agent details
    const agent = useragent.parse(userAgent);
    
    const userData = {
        timestamp: new Date().toISOString(),
        ip: ip,
        publicIp: req.ip,
        headers: {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            'cf-connecting-ip': req.headers['cf-connecting-ip']
        },
        browser: {
            name: uaResult.browser.name || agent.family,
            version: uaResult.browser.version || agent.major,
            full: userAgent
        },
        os: {
            name: uaResult.os.name || agent.os.family,
            version: uaResult.os.version,
            full: agent.os.toString()
        },
        device: {
            vendor: uaResult.device.vendor,
            model: uaResult.device.model,
            type: uaResult.device.type || (agent.device.family !== 'Other' ? agent.device.family : 'Desktop')
        },
        engine: {
            name: uaResult.engine.name,
            version: uaResult.engine.version
        },
        cpu: {
            architecture: uaResult.cpu.architecture
        },
        screen: req.headers['viewport-width'] ? {
            width: req.headers['viewport-width'],
            height: req.headers['viewport-height']
        } : null,
        language: req.headers['accept-language'],
        connection: {
            remoteAddress: req.connection.remoteAddress,
            remotePort: req.connection.remotePort
        },
        geo: geo ? {
            country: geo.country,
            region: geo.region,
            city: geo.city,
            ll: geo.ll,
            timezone: geo.timezone
        } : null,
        request: {
            method: req.method,
            url: req.url,
            protocol: req.protocol,
            secure: req.secure,
            hostname: req.hostname
        }
    };

    // Read existing logs
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

    // Add new log entry
    logs.push(userData);

    // Save to file (in production, use a database)
    try {
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        console.log(`Logged data from IP: ${ip}`);
    } catch (err) {
        console.error('Error writing log file:', err);
    }

    return userData;
}

// API endpoint to get user data (optional)
app.get('/api/userinfo', (req, res) => {
    const userData = logUserData(req);
    res.json({
        message: 'Data collected successfully',
        data: userData
    });
});

// Serve maintenance page and collect data
app.get('/', (req, res) => {
    // Log user data
    logUserData(req);
    
    // Send the maintenance page
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API to get all collected data (for admin view)
app.get('/api/logs', (req, res) => {
    try {
        const logFile = path.join(dataDir, 'logs.json');
        if (fs.existsSync(logFile)) {
            const data = fs.readFileSync(logFile, 'utf8');
            const logs = JSON.parse(data);
            res.json({
                total: logs.length,
                logs: logs
            });
        } else {
            res.json({ total: 0, logs: [] });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to read logs' });
    }
});

// API to clear logs (optional)
app.delete('/api/logs', (req, res) => {
    try {
        const logFile = path.join(dataDir, 'logs.json');
        fs.writeFileSync(logFile, JSON.stringify([], null, 2));
        res.json({ message: 'Logs cleared successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`User data is being logged to ${dataDir}/logs.json`);
});
