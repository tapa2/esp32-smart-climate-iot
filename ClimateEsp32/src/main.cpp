#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SensirionI2cScd4x.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>


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

// Адреса на PythonAnywhere 
const String serverName = "https://tapa2.pythonanywhere.com/update";
// ===============================================

// Таймери 
unsigned long lastActionTime = 0;
const unsigned long ACTION_INTERVAL = 300000; 

uint16_t currentCo2 = 0;
float currentTemp = 0.0f;
float currentHum = 0.0f;

void updateScreen();
bool sendDataToServer(String jsonPayload);
void saveOfflineData(String jsonPayload);
void syncOfflineData();

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
    display.println("ClimateControl v2.1");
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
  if(WiFi.status() == WL_CONNECTED) Serial.println("\nWiFi Connected!");
  else Serial.println("\nWiFi Offline. Starting in eco-mode.");
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
        Serial.printf("Успішно зчитано: CO2: %u ppm, Temp: %.2f C, Hum: %.2f %%\n", currentCo2, currentTemp, currentHum);

       
        updateScreen();

        
        String jsonPayload = "{\"temp\": " + String(currentTemp, 2) + 
                             ", \"hum\": " + String(currentHum, 2) + 
                             ", \"co2\": " + String(currentCo2) + "}";

        
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

void updateScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  
  display.setCursor(0, 0);
  display.println("ClimateControl v2.1");
  if(WiFi.status() == WL_CONNECTED) display.println("WiFi: Connected [ECO]");
  else display.println("WiFi: Offline [ECO]");
  
  display.setCursor(0, 22); display.printf("CO2:  %u ppm\n", currentCo2);
  display.setCursor(0, 37); display.printf("Temp: %.1f C\n", currentTemp);
  display.setCursor(0, 52); display.printf("Hum:  %.1f %%\n", currentHum);
  display.display();
}

bool sendDataToServer(String jsonPayload) {
  WiFiClientSecure client;
  client.setInsecure(); 
  HTTPClient http;
  
  http.begin(client, serverName);
  http.addHeader("Content-Type", "application/json");

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