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
        const data = await res.json(); // Тепер це масив [{}, {}, ...]

        if (data.length > 0) {
            const latest = data[data.length - 1];
            
            document.getElementById('co2-val').innerText = latest.co2;
            document.getElementById('temp-val').innerText = latest.temp;
            document.getElementById('hum-val').innerText = latest.hum;
            document.getElementById('last-update').innerText = latest.timestamp;

            chart.data.labels = data.map(entry => entry.timestamp.split(' ')[1]); // Тільки час
            chart.data.datasets[0].data = data.map(entry => entry.co2);
            chart.update();
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

setInterval(updateDashboard, 3000);