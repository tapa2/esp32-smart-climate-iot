class StatisticsManager {
    constructor() {
        this.chart = null;
        this.rawData = [];
        this.currentDate = null;

        this.initChart();
        this.setupDatePicker();
        this.bindEvents();
    }

    setupDatePicker() {
        const today = new Date();
        const minDateObj = new Date();
        minDateObj.setDate(today.getDate() - 14);

        flatpickr("#date-picker", {
            locale: "uk",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d.m.Y",
            defaultDate: "today",
            maxDate: "today",
            minDate: minDateObj,
            disableMobile: "true",
            onChange: () => {
                this.setExportEnabled(false);
            },
            onReady: () => {
                this.loadData();
            }
        });
    }

    initChart() {
        const ctx = document.getElementById('historyChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Середнє значення', data: [], backgroundColor: '#4caf50', borderRadius: 4 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: false, grid: { color: '#333' } }, x: { grid: { color: '#333' } } },
                plugins: { legend: { labels: { color: '#e0e0e0' } } }
            }
        });
    }

    bindEvents() {
        document.getElementById('load-history-btn').addEventListener('click', () => {
            this.loadData();
        });

        const csvBtn = document.getElementById('export-csv-btn');
        const jsonBtn = document.getElementById('export-json-btn');
        if (csvBtn) csvBtn.addEventListener('click', () => this.exportCSV());
        if (jsonBtn) jsonBtn.addEventListener('click', () => this.exportJSON());
    }

    setExportEnabled(enabled) {
        const csvBtn = document.getElementById('export-csv-btn');
        const jsonBtn = document.getElementById('export-json-btn');
        if (csvBtn) csvBtn.disabled = !enabled;
        if (jsonBtn) jsonBtn.disabled = !enabled;
    }

    async loadData() {
        const dateVal = document.getElementById('date-picker').value;
        const param = document.getElementById('param-picker').value;

        if (!dateVal) return;
        this.currentDate = dateVal;

        const dateObj = new Date(dateVal);
        const displayDate = dateObj.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const localStart = new Date(`${dateVal}T00:00:00`);
        const localEnd = new Date(`${dateVal}T00:00:00`);
        localEnd.setDate(localEnd.getDate() + 1);

        const startUtc = localStart.toISOString();
        const endUtc = localEnd.toISOString();

        try {
            const response = await fetch(`/api/history?start=${startUtc}&end=${endUtc}`);
            const rawData = await response.json();

            if (rawData.error) {
                console.error("Помилка:", rawData.error);
                this.setExportEnabled(false);
                return;
            }

            this.rawData = Array.isArray(rawData) ? rawData : [];
            this.setExportEnabled(this.rawData.length > 0);

            const hourlyData = {};
            for (let i = 0; i < 24; i++) { hourlyData[i] = { sum: 0, count: 0 }; }

            this.rawData.forEach(record => {
                const utcDate = new Date(record.timestamp.replace(' ', 'T') + 'Z');
                const localHour = utcDate.getHours();
                const val = record[param];
                if (val === null || val === undefined) return;
                hourlyData[localHour].sum += val;
                hourlyData[localHour].count += 1;
            });

            const chartLabels = [];
            const chartValues = [];

            for (let i = 0; i < 24; i++) {
                if (hourlyData[i].count > 0) {
                    const avg = hourlyData[i].sum / hourlyData[i].count;
                    const hourString = i.toString().padStart(2, '0') + ":00";
                    chartLabels.push(hourString);
                    chartValues.push(avg.toFixed(2));
                }
            }

            if (chartLabels.length === 0) {
                this.updateChart([], [], param);
                document.getElementById('history-chart-title').innerText = `Немає даних за ${displayDate}`;
            } else {
                this.updateChart(chartLabels, chartValues, param);
                document.getElementById('history-chart-title').innerText = `Графік середніх значень за ${displayDate}`;
            }

        } catch (error) {
            console.error("Помилка завантаження історії:", error);
            this.setExportEnabled(false);
        }
    }

    updateChart(labels, values, param) {
        let color = '#4caf50'; let labelName = 'Значення';
        if (param === 'co2')  { color = '#2196f3'; labelName = 'Середній рівень CO2 (ppm)'; }
        if (param === 'temp') { color = '#f44336'; labelName = 'Середня температура (°C)'; }
        if (param === 'hum')  { color = '#4caf50'; labelName = 'Середня вологість (%)'; }
        if (param === 'iaq')  { color = '#9c27b0'; labelName = 'Середній IAQ (0–100)'; }

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = values;
        this.chart.data.datasets[0].backgroundColor = color;
        this.chart.data.datasets[0].label = labelName;
        this.chart.update();
    }

    csvEscape(value) {
        if (value === null || value === undefined) return '';
        const s = String(value);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    exportCSV() {
        if (!this.rawData || this.rawData.length === 0) {
            alert("Немає даних для експорту. Спочатку завантажте день.");
            return;
        }
        const header = "timestamp_utc,co2_ppm,temp_c,hum_percent,iaq\n";
        const rows = this.rawData.map(r => [
            this.csvEscape(r.timestamp),
            this.csvEscape(r.co2),
            this.csvEscape(r.temp),
            this.csvEscape(r.hum),
            this.csvEscape(r.iaq)
        ].join(',')).join('\n');
        const blob = new Blob(['﻿', header, rows], { type: 'text/csv;charset=utf-8;' });
        this.downloadBlob(blob, `climate-${this.currentDate || 'data'}.csv`);
    }

    exportJSON() {
        if (!this.rawData || this.rawData.length === 0) {
            alert("Немає даних для експорту. Спочатку завантажте день.");
            return;
        }
        const payload = {
            generated_at: new Date().toISOString(),
            date: this.currentDate,
            count: this.rawData.length,
            records: this.rawData
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, `climate-${this.currentDate || 'data'}.json`);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

document.addEventListener('DOMContentLoaded', () => new StatisticsManager());
