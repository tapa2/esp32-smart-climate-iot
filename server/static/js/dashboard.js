class DashboardManager {
    constructor() {
        this.updateInterval = 300000; 
        this.chart = null;
        
        this.defaultSettings = {
            co2: { enabled: true, max: 1000 },
            temp: { enabled: true, min: 18, max: 24 },
            hum: { enabled: true, min: 40, max: 60 }
        };

        this.userSettings = JSON.parse(JSON.stringify(this.defaultSettings));

        this.loadSettings();
        this.initChart();
        this.bindEvents();
        this.checkFirstSetup();
        this.fetchData(); 
        
        setInterval(() => this.fetchData(), this.updateInterval);
    }

    formatLocalTime(utcString) {
        if (!utcString) return "--:--:--";
        const dateObj = new Date(utcString.replace(' ', 'T') + 'Z');
        return dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    validateSettings(co2Max, tMin, tMax, hMin, hMax) {
        if (tMin > tMax) { alert("Помилка: Мінімальна температура не може бути більшою за максимальну!"); return false; }
        if (tMin < -5 || tMax > 50) { alert("Помилка: Допустима температура від -5 до 50 °C!"); return false; }
        
        if (hMin > hMax) { alert("Помилка: Мінімальна вологість не може бути більшою за максимальну!"); return false; }
        if (hMin < 0 || hMax > 100) { alert("Помилка: Вологість має бути в межах 0 - 100%!"); return false; }
        
        if (co2Max < 400 || co2Max > 5000) { alert("Помилка: Адекватний рівень CO2 знаходиться в межах 400 - 5000 ppm!"); return false; }
        
        return true;
    }

    checkFirstSetup() {
        const isSetupDone = localStorage.getItem('climateSetupComplete');
        
        if (!isSetupDone) {
            const modal = document.getElementById('setup-modal');
            const tzDisplay = document.getElementById('detected-timezone');
            tzDisplay.innerText = Intl.DateTimeFormat().resolvedOptions().timeZone;
            modal.classList.add('active');

            document.getElementById('modal-save-btn').addEventListener('click', () => {
                const cMax = parseInt(document.getElementById('modal-co2').value);
                const tMin = parseInt(document.getElementById('modal-temp-min').value);
                const tMax = parseInt(document.getElementById('modal-temp-max').value);
                const hMin = parseInt(document.getElementById('modal-hum-min').value);
                const hMax = parseInt(document.getElementById('modal-hum-max').value);
                
                // Якщо перевірка не пройдена - зупиняємо збереження
                if (!this.validateSettings(cMax, tMin, tMax, hMin, hMax)) return;

                this.userSettings.co2.max = cMax;
                this.userSettings.temp.min = tMin;
                this.userSettings.temp.max = tMax;
                this.userSettings.hum.min = hMin;
                this.userSettings.hum.max = hMax;
                
                localStorage.setItem('climateSettingsAdvanced', JSON.stringify(this.userSettings));
                localStorage.setItem('climateSetupComplete', 'true');
                
                this.updateInputsFromSettings();
                this.fetchData(); 
                modal.classList.remove('active');
            });
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('climateSettingsAdvanced');
        if (saved) this.userSettings = JSON.parse(saved);
        this.updateInputsFromSettings();
    }

    updateInputsFromSettings() {
        document.getElementById('check-co2').checked = this.userSettings.co2.enabled;
        document.getElementById('max-co2').value = this.userSettings.co2.max;
        
        document.getElementById('check-temp').checked = this.userSettings.temp.enabled;
        document.getElementById('min-temp').value = this.userSettings.temp.min;
        document.getElementById('max-temp').value = this.userSettings.temp.max;
        
        document.getElementById('check-hum').checked = this.userSettings.hum.enabled;
        document.getElementById('min-hum').value = this.userSettings.hum.min;
        document.getElementById('max-hum').value = this.userSettings.hum.max;
    }

    bindEvents() {
        document.getElementById('settings-toggle').addEventListener('click', () => {
            const content = document.getElementById('settings-content');
            const arrow = document.getElementById('settings-arrow');
            if (content.style.display === 'none') {
                content.style.display = 'block'; arrow.innerText = '▲';
            } else {
                content.style.display = 'none'; arrow.innerText = '▼';
            }
        });

        document.getElementById('save-settings-btn').addEventListener('click', () => {
            const cMax = parseInt(document.getElementById('max-co2').value);
            const tMin = parseInt(document.getElementById('min-temp').value);
            const tMax = parseInt(document.getElementById('max-temp').value);
            const hMin = parseInt(document.getElementById('min-hum').value);
            const hMax = parseInt(document.getElementById('max-hum').value);

            // Якщо перевірка не пройдена - зупиняємо збереження
            if (!this.validateSettings(cMax, tMin, tMax, hMin, hMax)) return;

            this.userSettings.co2.enabled = document.getElementById('check-co2').checked;
            this.userSettings.co2.max = cMax;
            
            this.userSettings.temp.enabled = document.getElementById('check-temp').checked;
            this.userSettings.temp.min = tMin;
            this.userSettings.temp.max = tMax;
            
            this.userSettings.hum.enabled = document.getElementById('check-hum').checked;
            this.userSettings.hum.min = hMin;
            this.userSettings.hum.max = hMax;

            localStorage.setItem('climateSettingsAdvanced', JSON.stringify(this.userSettings));
            this.fetchData(); 
            
            const btn = document.getElementById('save-settings-btn');
            btn.innerText = "Збережено!"; btn.style.backgroundColor = "#4caf50";
            setTimeout(() => { btn.innerText = "Зберегти налаштування"; btn.style.backgroundColor = ""; }, 2000);
        });

        document.getElementById('reset-settings-btn').addEventListener('click', () => {
            if(confirm("Скинути налаштування до рекомендованих норм?")) {
                this.userSettings = JSON.parse(JSON.stringify(this.defaultSettings));
                this.updateInputsFromSettings();
                localStorage.setItem('climateSettingsAdvanced', JSON.stringify(this.userSettings));
                this.fetchData();
            }
        });
    }

    initChart() {
        const ctx = document.getElementById('realtimeChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Рівень CO2 (ppm)', data: [], borderColor: '#2196f3', backgroundColor: 'rgba(33, 150, 243, 0.1)', tension: 0.4, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#333' } }, x: { grid: { color: '#333' } } }, plugins: { legend: { labels: { color: '#e0e0e0' }, onClick: (e) => e.stopPropagation() } } }
        });
    }

    async fetchData() {
        try {
            const response = await fetch('/data');
            const data = await response.json();
            if (data && data.length > 0) this.updateUI(data);
        } catch (error) { console.error("Помилка:", error); }
    }

    updateUI(historyData) {
        const latest = historyData[historyData.length - 1];

        document.getElementById('co2-val').innerText = latest.co2;
        document.getElementById('temp-val').innerText = latest.temp;
        document.getElementById('hum-val').innerText = latest.hum;
        document.getElementById('last-update').innerText = this.formatLocalTime(latest.timestamp);

        this.updateStatus(historyData);

        this.chart.data.labels = historyData.map(d => this.formatLocalTime(d.timestamp));
        this.chart.data.datasets[0].data = historyData.map(d => d.co2);
        this.chart.update();
    }

    updateStatus(historyData) {
        const statusBox = document.getElementById('status-indicator');
        const recentPoints = historyData.slice(-3);
        let penaltyScore = 0; 
        let latestAdvice = "Мікроклімат у вашій зоні комфорту.";
        
        recentPoints.forEach((data, index) => {
            let isPointBad = false;
            if (this.userSettings.co2.enabled && data.co2 > this.userSettings.co2.max) {
                isPointBad = true;
                if (index === recentPoints.length - 1) latestAdvice = `Рівень CO2 підвищується (${data.co2} ppm). Бажано провітрити.`;
            } 
            if (this.userSettings.temp.enabled) {
                if (data.temp < this.userSettings.temp.min) {
                    isPointBad = true;
                    if (index === recentPoints.length - 1) latestAdvice = `Температура падає (${data.temp}°C). Увімкніть обігрів.`;
                } else if (data.temp > this.userSettings.temp.max) {
                    isPointBad = true;
                    if (index === recentPoints.length - 1) latestAdvice = `Температура зависока (${data.temp}°C). Охолодіть приміщення.`;
                }
            }
            if (this.userSettings.hum.enabled) {
                if (data.hum < this.userSettings.hum.min) {
                    isPointBad = true;
                    if (index === recentPoints.length - 1) latestAdvice = `Повітря сохне (${data.hum}%). Зволожте кімнату.`;
                } else if (data.hum > this.userSettings.hum.max) {
                    isPointBad = true;
                    if (index === recentPoints.length - 1) latestAdvice = `Занадто волого (${data.hum}%).`;
                }
            }
            if (isPointBad) penaltyScore += 1;
        });

        statusBox.innerText = latestAdvice;

        if (penaltyScore === 0) {
            statusBox.style.backgroundColor = "rgba(76, 175, 80, 0.1)"; statusBox.style.borderColor = "#4caf50"; statusBox.style.color = "#e0e0e0";
        } else if (penaltyScore === 1) {
            statusBox.style.backgroundColor = "rgba(255, 235, 59, 0.1)"; statusBox.style.borderColor = "#ffeb3b"; statusBox.style.color = "#fff59d";
        } else if (penaltyScore === 2) {
            statusBox.style.backgroundColor = "rgba(255, 152, 0, 0.1)"; statusBox.style.borderColor = "#ff9800"; statusBox.style.color = "#ffcc80";
        } else if (penaltyScore >= 3) {
            statusBox.style.backgroundColor = "rgba(244, 67, 54, 0.15)"; statusBox.style.borderColor = "#f44336"; statusBox.style.color = "#ffcdd2";
            statusBox.innerText = "КРИТИЧНО: " + latestAdvice; 
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new DashboardManager());