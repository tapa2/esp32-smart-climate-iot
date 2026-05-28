import os
import time
import random
from datetime import datetime, timezone

import requests

URL = "http://127.0.0.1:5000/update"
DEVICE_TOKEN = os.environ.get("DEVICE_TOKEN", "esp32-climate-secret-2026")

HEADERS = {
    "Content-Type": "application/json",
    "X-Device-Token": DEVICE_TOKEN,
}


def _iaq(co2, temp, hum):
    if co2 <= 600:    c = 100
    elif co2 <= 1000: c = 80
    elif co2 <= 1500: c = 60
    elif co2 <= 2000: c = 40
    elif co2 <= 3000: c = 20
    else:             c = 0

    if 20 <= temp <= 24:    t = 100
    elif 18 <= temp <= 26:  t = 80
    elif 16 <= temp <= 28:  t = 60
    elif 14 <= temp <= 30:  t = 40
    else:                   t = 20

    if 40 <= hum <= 60:     h = 100
    elif 30 <= hum <= 70:   h = 80
    elif 20 <= hum <= 80:   h = 60
    else:                   h = 30

    return int(round(c * 0.4 + t * 0.3 + h * 0.3))


print("Запуск імітації ESP32. Надсилаю дані на сервер...")

while True:
    temp = round(random.uniform(20.0, 25.0), 1)
    hum = random.randint(40, 60)
    co2 = random.randint(400, 1200)
    payload = {
        "temp": temp,
        "hum": hum,
        "co2": co2,
        "iaq": _iaq(co2, temp, hum),
        "ts": int(datetime.now(timezone.utc).timestamp()),
    }

    try:
        response = requests.post(URL, json=payload, headers=HEADERS, timeout=5)
        print(f"Відправлено: {payload} | Статус сервера: {response.status_code}")
    except Exception as e:
        print(f"Помилка зв'язку: {e}")

    time.sleep(5)
