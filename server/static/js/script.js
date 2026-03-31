// static/js/script.js
const ctx = document.getElementById('myChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'CO2 Concentration (ppm)',
            data: [],
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            fill: true,
            tension: 0.4
        }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: false } } }
});

async function updateDashboard() {
    try {
        const res = await fetch('/data');
        const data = await res.json();

        console.log("Отримані дані для графіка:", data);

        document.getElementById('co2-val').innerText = data.co2;
        document.getElementById('temp-val').innerText = data.temp;
        document.getElementById('hum-val').innerText = data.hum;
        document.getElementById('last-update').innerText = new Date().toLocaleTimeString();

        const now = new Date().toLocaleTimeString();
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(data.co2);
        
        if (chart.data.labels.length > 15) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update('none'); // Оновлюємо без зайвої анімації для швидкості
    } catch (e) { console.error("Fetch error:", e); }
}

setInterval(updateDashboard, 3000);