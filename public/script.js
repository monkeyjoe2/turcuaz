// Countdown timer
function updateCountdown() {
    const now = new Date();
    const target = new Date();
    
    // Set target to 3 hours from now
    target.setHours(now.getHours() + 3);
    
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

// Animated progress bar
function animateProgressBar() {
    const progressFill = document.querySelector('.progress-fill');
    let width = 65;
    
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            return;
        }
        
        width += 0.1;
        progressFill.style.width = width + '%';
        document.querySelector('.progress-percent').textContent = Math.floor(width) + '%';
    }, 100);
}

// Add hover effects to status items
function addHoverEffects() {
    const statusItems = document.querySelectorAll('.status-item');
    
    statusItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            const icon = this.querySelector('i');
            icon.style.transform = 'scale(1.1) rotate(5deg)';
        });
        
        item.addEventListener('mouseleave', function() {
            const icon = this.querySelector('i');
            icon.style.transform = 'scale(1) rotate(0deg)';
        });
    });
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateCountdown();
    animateProgressBar();
    addHoverEffects();
    
    // Update countdown every second
    setInterval(updateCountdown, 1000);
    
    // Collect additional client-side data (optional)
    collectClientData();
});

// Collect additional client-side data
function collectClientData() {
    const clientData = {
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        language: navigator.language,
        online: navigator.onLine,
        cookiesEnabled: navigator.cookieEnabled,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
    };
    
    // Send to server (optional)
    fetch('/api/userinfo', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Viewport-Width': clientData.viewportWidth,
            'Viewport-Height': clientData.viewportHeight
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Client data collection successful');
    })
    .catch(err => {
        console.log('Client data collection failed (expected if offline)');
    });
}
