from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from datetime import datetime

app = Flask(__name__)

# Налаштування
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///climate.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class SensorData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow) # Зберігається завжди в UTC
    temp = db.Column(db.Float, nullable=False)
    hum = db.Column(db.Float, nullable=False)
    co2 = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "temp": self.temp,
            "hum": self.hum,
            "co2": self.co2
        }

with app.app_context():
    db.create_all()

@app.route('/')
def home():
    return "<h1>Сервер працює!</h1><p><a href='/dashboard'>Дашборд</a></p>"

@app.route('/dashboard')
def dashboard():
    return render_template('index.html')

@app.route('/statistics')
def statistics():
    return render_template('statistics.html')

@app.route('/update', methods=['POST'])
def update_data():
    data = request.get_json()
    if data:
        new_entry = SensorData(
            temp=data.get('temp'),
            hum=data.get('hum'),
            co2=data.get('co2')
        )
        db.session.add(new_entry)
        db.session.commit()
        return jsonify({"status": "success"}), 200
    return jsonify({"status": "error"}), 400

@app.route('/data')
def get_data():
    history = SensorData.query.order_by(SensorData.timestamp.desc()).limit(20).all()
    return jsonify([entry.to_dict() for entry in reversed(history)])

# ОНОВЛЕНИЙ МАРШРУТ АНАЛІТИКИ
@app.route('/api/history')
def get_history():
    start_utc_str = request.args.get('start')
    end_utc_str = request.args.get('end')
    
    if not start_utc_str or not end_utc_str:
        return jsonify({"error": "Missing parameters"}), 400

    try:
        # Конвертуємо отримані рядки з JS у об'єкти datetime
        start_dt = datetime.strptime(start_utc_str[:19], '%Y-%m-%dT%H:%M:%S')
        end_dt = datetime.strptime(end_utc_str[:19], '%Y-%m-%dT%H:%M:%S')
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    # Забираємо всі записи в межах потрібного дня (в розрізі UTC)
    records = SensorData.query.filter(
        SensorData.timestamp >= start_dt,
        SensorData.timestamp < end_dt
    ).order_by(SensorData.timestamp.asc()).all()

    return jsonify([r.to_dict() for r in records])

if __name__ == '__main__':
    # Слухаємо всю Wi-Fi мережу
    app.run(debug=True, host='0.0.0.0', port=5000)