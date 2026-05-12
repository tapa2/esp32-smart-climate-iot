class StatisticsManager {
    constructor() {
        this.chart = null;
        this.initChart();
        this.bindEvents();
        this.setDefaultDate();
    }

    setDefaultDate() {
        // Автоматично ставимо сьогоднішню дату в календар
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date-picker').value = today;
    }

    initChart() {
        const ctx = document.getElementById('historyChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'bar', // Стовпчиковий графік для середніх значень за годину
            data: {
                labels: [],
                datasets: [{
                    label: 'Середнє значення',
                    data: [],
                    backgroundColor: '#4caf50',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: false, grid: { color: '#333' } },
                    x: { grid: { color: '#333' } }
                },
                plugins: {
                    legend: { labels: { color: '#e0e0e0' } }
                }
            }
        });
    }

    bindEvents() {
        // Реакція на натискання кнопки
        document.getElementById('load-history-btn').addEventListener('click', () => {
            this.loadData();
        });
    }

    async loadData() {
        const date = document.getElementById('date-picker').value;
        const param = document.getElementById('param-picker').value;

        if (!date) {
            alert("Будь ласка, оберіть дату!");
            return;
        }

        try {
            // Звертаємось до нашого нового API маршруту в Python
            const response = await fetch(`/api/history?date=${date}&param=${param}`);
            const data = await response.json();

            if (data.error) {
                alert("Помилка сервера: " + data.error);
                return;
            }

            if (data.length === 0) {
                alert("За обрану дату немає даних в базі. Спробуйте інший день.");
                this.chart.data.labels = [];
                this.chart.data.datasets[0].data = [];
                this.chart.update();
                return;
            }

            this.updateChart(data, param);

        } catch (error) {
            console.error("Помилка завантаження історії:", error);
        }
    }

    updateChart(data, param) {
        // Налаштовуємо кольори та підписи залежно від обраного параметра
        let color = '#4caf50';
        let labelName = 'Значення';
        
        if (param === 'co2') { color = '#2196f3'; labelName = 'Середній рівень CO2 (ppm)'; }
        if (param === 'temp') { color = '#f44336'; labelName = 'Середня температура (°C)'; }
        if (param === 'hum') { color = '#4caf50'; labelName = 'Середня вологість (%)'; }

        // Малюємо нові дані
        this.chart.data.labels = data.map(d => d.hour);
        this.chart.data.datasets[0].data = data.map(d => d.value);
        this.chart.data.datasets[0].backgroundColor = color;
        this.chart.data.datasets[0].label = labelName;
        
        this.chart.update();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StatisticsManager();
});