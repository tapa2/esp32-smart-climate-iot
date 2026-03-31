import requests
import time
import random

# Адреса твого сервера (використовуй ту саму, що й на телефоні)
URL = "http://127.0.0.1:5000/update"

print("Запуск імітації ESP32. Надсилаю дані на сервер...")

while True:
    # Геруємо випадкові дані, як справжній SCD40
    payload = {
        "temp": round(random.uniform(20.0, 25.0), 1),
        "hum": random.randint(40, 60),
        "co2": random.randint(400, 1200)
    }
    
    try:
        response = requests.post(URL, json=payload)
        print(f"Відправлено: {payload} | Статус сервера: {response.status_code}")
    except Exception as e:
        print(f"Помилка зв'язку: {e}")
    
    time.sleep(5) # Відправка кожні 5 секунд