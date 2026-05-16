class StatisticsManager {
    constructor() {
        this.chart = null;
        this.initChart();
        this.setupDatePicker();
        this.bindEvents();
    }

    setupDatePicker() {
        const today = new Date();
        const minDateObj = new Date();
        minDateObj.setDate(today.getDate() - 14);

        // Ініціалізуємо Flatpickr
        flatpickr("#date-picker", {
            locale: "uk",               // Українська мова календаря
            dateFormat: "Y-m-d",        // Технічний формат для нашого коду
            altInput: true,             // Створює видиме поле для користувача
            altFormat: "d.m.Y",         // Візуальний формат: 16.05.2026
            defaultDate: "today",       // За замовчуванням сьогодні
            maxDate: "today",           // Не можна вибрати майбутнє
            minDate: minDateObj,        // Не можна вибрати старіше 14 днів
            disableMobile: "true",      // Форсуємо красивий дизайн навіть на смартфонах
            onChange: () => {
                // Якщо користувач обрав іншу дату, можемо (за бажанням) одразу вантажити графік
                // this.loadData(); 
            },
            onReady: () => {
                // Завантажуємо графік, коли календар повністю готовий
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
    }

    async loadData() {
        const dateVal = document.getElementById('date-picker').value;
        const param = document.getElementById('param-picker').value;

        if (!dateVal) return;

        // Форматуємо дату для заголовка графіка
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

            if (rawData.error) { console.error("Помилка:", rawData.error); return; }

            const hourlyData = {};
            for (let i = 0; i < 24; i++) { hourlyData[i] = { sum: 0, count: 0 }; }

            rawData.forEach(record => {
                const utcDate = new Date(record.timestamp.replace(' ', 'T') + 'Z');
                const localHour = utcDate.getHours();
                hourlyData[localHour].sum += record[param];
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
        }
    }

    updateChart(labels, values, param) {
        let color = '#4caf50'; let labelName = 'Значення';
        if (param === 'co2') { color = '#2196f3'; labelName = 'Середній рівень CO2 (ppm)'; }
        if (param === 'temp') { color = '#f44336'; labelName = 'Середня температура (°C)'; }
        if (param === 'hum') { color = '#4caf50'; labelName = 'Середня вологість (%)'; }

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = values;
        this.chart.data.datasets[0].backgroundColor = color;
        this.chart.data.datasets[0].label = labelName;
        this.chart.update();
    }
}

document.addEventListener('DOMContentLoaded', () => new StatisticsManager());