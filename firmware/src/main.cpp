#include <Arduino.h>
#include <SensirionI2cScd4x.h>
#include <Wire.h>


SensirionI2CScd4x scd4x; 

void setup() {
    Serial.begin(115200);
    Wire.begin(21, 22); 

    uint16_t error;
    char errorMessage[256];

    scd4x.begin(Wire);

    error = scd4x.stopPeriodicMeasurement();
    error = scd4x.startPeriodicMeasurement();
    
    if (error) {
        Serial.print("Помилка запуску SCD4x: ");
        // 2. ВИПРАВЛЕНО: errorToString (замість error_to_string)
        errorToString(error, errorMessage, 256);
        Serial.println(errorMessage);
    }
}

void loop() {
    uint16_t co2;
    float temperature;
    float humidity;

    // 3. Тепер scd4x буде розпізнано, бо ми правильно оголосили тип вище
    uint16_t error = scd4x.readMeasurement(co2, temperature, humidity);

    if (!error) {
        Serial.print("CO2: "); Serial.print(co2);
        Serial.print(" Temp: "); Serial.print(temperature);
        Serial.print(" Hum: "); Serial.println(humidity);
    } else {
        Serial.print("Помилка читання: ");
        char errorMsg[256];
        errorToString(error, errorMsg, 256);
        Serial.println(errorMsg);
    }

    delay(5000); 
}