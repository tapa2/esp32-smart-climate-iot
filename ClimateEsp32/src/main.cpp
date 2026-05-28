#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SensirionI2cScd4x.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>
#include <time.h>


#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

SensirionI2cScd4x scd4x;


static char errorMessage[64];
static uint16_t error;

// ======= НАЛАШТУВАННЯ МЕРЕЖІ ТА СЕРВЕРА =======
const char *ssid = "Cyber room";
const char *password = "qwerty_802";

const String serverName = "https://tapa2.pythonanywhere.com/update";
const String deviceToken = "esp32-climate-secret-2026";

const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;
const int daylightOffset_sec = 0;
bool timeSynced = false;
// ===============================================

unsigned long lastActionTime = 0;
const unsigned long ACTION_INTERVAL = 300000;

uint16_t currentCo2 = 0;
float currentTemp = 0.0f;
float currentHum = 0.0f;
int currentIAQ = 0;
String currentIAQLabel = "--";

void updateScreen();
bool sendDataToServer(String jsonPayload);
void saveOfflineData(String jsonPayload);
void syncOfflineData();
int calculateIAQ(uint16_t co2, float temp, float hum);
String iaqToLabel(int iaq);
unsigned long getEpochTime();
void trySyncNtp(uint32_t timeoutMs);

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(100); }

  if (!LittleFS.begin(true)) {
    Serial.println("Помилка LittleFS!");
  }

  Wire.begin(21, 22);

  if(display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(WHITE);
    display.setCursor(0, 20);
    display.println("ClimateControl v2.2");
    display.println("Energy Saving Mode...");
    display.display();
  }

  scd4x.begin(Wire, SCD41_I2C_ADDR_62);
  scd4x.wakeUp();
  scd4x.stopPeriodicMeasurement();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if(WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    trySyncNtp(5000);
  } else {
    Serial.println("\nWiFi Offline. Starting in eco-mode.");
  }
}

void loop() {

  if (millis() - lastActionTime >= ACTION_INTERVAL || lastActionTime == 0) {
    lastActionTime = millis();

    Serial.println("\n--- Запуск циклу вимірювання ---");

    error = scd4x.startPeriodicMeasurement();
    if (error != 0) {
      Serial.print("Помилка запуску датчика: ");
      errorToString(error, errorMessage, sizeof errorMessage);
      Serial.println(errorMessage);
      return;
    }

    bool dataReady = false;
    int timeout = 0;

    Serial.print("Очікування готовності даних");
    while (!dataReady && timeout < 16) {
      delay(500);
      Serial.print(".");
      scd4x.getDataReadyStatus(dataReady);
      timeout++;
    }
    Serial.println();

    if (dataReady) {
      error = scd4x.readMeasurement(currentCo2, currentTemp, currentHum);

      scd4x.stopPeriodicMeasurement();
      Serial.println("Датчик виконав замір та успішно переведений у режим сну.");

      if (error == 0 && currentCo2 > 0) {
        currentIAQ = calculateIAQ(currentCo2, currentTemp, currentHum);
        currentIAQLabel = iaqToLabel(currentIAQ);
        Serial.printf("CO2: %u ppm, Temp: %.2f C, Hum: %.2f %%, IAQ: %d (%s)\n",
                      currentCo2, currentTemp, currentHum, currentIAQ, currentIAQLabel.c_str());

        updateScreen();

        if (!timeSynced && WiFi.status() == WL_CONNECTED) {
          trySyncNtp(3000);
        }

        unsigned long ts = getEpochTime();

        String jsonPayload = "{\"temp\": " + String(currentTemp, 2) +
                             ", \"hum\": " + String(currentHum, 2) +
                             ", \"co2\": " + String(currentCo2) +
                             ", \"iaq\": " + String(currentIAQ) +
                             ", \"ts\": " + String(ts) + "}";

        if (WiFi.status() != WL_CONNECTED) {
          Serial.println("Wi-Fi відсутній. Спроба перепідключення...");
          WiFi.disconnect();
          WiFi.begin(ssid, password);
          saveOfflineData(jsonPayload);
        } else {
          bool success = sendDataToServer(jsonPayload);
          if (success) {
            syncOfflineData();
          } else {
            saveOfflineData(jsonPayload);
          }
        }
      } else {
        Serial.println("Отримано невалідні дані (можливо датчик прогрівається).");
      }
    } else {
      scd4x.stopPeriodicMeasurement();
      Serial.println("Помилка: Датчик не встиг підготувати дані за відведений час.");
    }
  }
}

// ----------- IAQ -----------
int calculateIAQ(uint16_t co2, float temp, float hum) {
  int co2Score;
  if (co2 <= 600)        co2Score = 100;
  else if (co2 <= 1000)  co2Score = 80;
  else if (co2 <= 1500)  co2Score = 60;
  else if (co2 <= 2000)  co2Score = 40;
  else if (co2 <= 3000)  co2Score = 20;
  else                   co2Score = 0;

  int tScore;
  if (temp >= 20 && temp <= 24)         tScore = 100;
  else if (temp >= 18 && temp <= 26)    tScore = 80;
  else if (temp >= 16 && temp <= 28)    tScore = 60;
  else if (temp >= 14 && temp <= 30)    tScore = 40;
  else                                  tScore = 20;

  int hScore;
  if (hum >= 40 && hum <= 60)           hScore = 100;
  else if (hum >= 30 && hum <= 70)      hScore = 80;
  else if (hum >= 20 && hum <= 80)      hScore = 60;
  else                                  hScore = 30;

  int total = (int) round(co2Score * 0.4 + tScore * 0.3 + hScore * 0.3);
  if (total < 0) total = 0;
  if (total > 100) total = 100;
  return total;
}

String iaqToLabel(int iaq) {
  if (iaq >= 80) return "Excellent";
  if (iaq >= 60) return "Good";
  if (iaq >= 40) return "Moderate";
  if (iaq >= 20) return "Poor";
  return "Hazard";
}

void trySyncNtp(uint32_t timeoutMs) {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, timeoutMs)) {
    timeSynced = true;
    Serial.println("Час синхронізовано з NTP.");
  } else {
    Serial.println("NTP-синхронізація не вдалася.");
  }
}

unsigned long getEpochTime() {
  if (!timeSynced) return 0;
  time_t now;
  time(&now);
  return (unsigned long) now;
}

void updateScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);

  display.setCursor(0, 0);
  display.println("ClimateControl v2.2");
  if(WiFi.status() == WL_CONNECTED) display.println("WiFi: Connected [ECO]");
  else display.println("WiFi: Offline [ECO]");

  display.setCursor(0, 22); display.printf("CO2:  %u ppm\n", currentCo2);
  display.setCursor(0, 34); display.printf("T:%.1fC  H:%.0f%%\n", currentTemp, currentHum);
  display.setCursor(0, 50); display.printf("IAQ:%d %s", currentIAQ, currentIAQLabel.c_str());
  display.display();
}

bool sendDataToServer(String jsonPayload) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  http.begin(client, serverName);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", deviceToken);

  int httpCode = http.POST(jsonPayload);
  http.end();

  if (httpCode == 200) {
    Serial.println("-> Дані успішно доставлено на сервер.");
    return true;
  } else {
    Serial.printf("-> Помилка сервера. Код відповіді: %d\n", httpCode);
    return false;
  }
}

void saveOfflineData(String jsonPayload) {
  File checkFile = LittleFS.open("/offline.txt", "r");
  if (checkFile && checkFile.size() > 20000) {
    checkFile.close();
    LittleFS.remove("/offline.txt");
    Serial.println("Архівація: Пам'ять переповнена, старі записи видалено.");
  } else if (checkFile) { checkFile.close(); }

  File file = LittleFS.open("/offline.txt", "a");
  if (file) {
    file.print(jsonPayload + "\n");
    file.close();
    Serial.println("-> Дані збережено у внутрішню пам'ять ESP32 (офлайн режим).");
  }
}

void syncOfflineData() {
  if (!LittleFS.exists("/offline.txt")) return;

  Serial.println("Виявлено офлайн-архіви. Починаю вивантаження...");

  File file = LittleFS.open("/offline.txt", "r");
  File temp = LittleFS.open("/temp.txt", "w");

  bool syncFailed = false;

  while (file.available()) {
    String payload = file.readStringUntil('\n');
    if (payload.length() < 5) continue;

    if (!syncFailed) {
      bool success = sendDataToServer(payload);
      if (success) {
        Serial.println("  [+] Архівний рядок синхронізовано.");
        delay(200);
      } else {
        Serial.println("  [-] Помилка передачі архіву. Зупиняю синхронізацію.");
        syncFailed = true;
        temp.print(payload + "\n");
      }
    } else {
      temp.print(payload + "\n");
    }
  }

  file.close();
  temp.close();

  LittleFS.remove("/offline.txt");
  LittleFS.rename("/temp.txt", "/offline.txt");

  if(!syncFailed) Serial.println("Всі офлайн дані успішно синхронізовано. Пам'ять чиста.");
}
