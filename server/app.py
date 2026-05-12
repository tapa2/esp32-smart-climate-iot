from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from datetime import datetime

app = Flask(__name__)

# 1. Налаштування
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///climate.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# 2. Модель даних
class SensorData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    temp = db.Column(db.Float, nullable=False)
    hum = db.Column(db.Float, nullable=False)
    co2 = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "temp": self.temp,
            "hum": self.hum,
            "co2": self.co2
        }

# 3. Ініціалізація БД
with app.app_context():
    db.create_all()

# 4. МАРШРУТИ ДЛЯ СТОРІНОК
@app.route('/')
def home():
    return "<h1>Сервер працює!</h1><p><a href='/dashboard'>Дашборд</a></p>"

@app.route('/dashboard')
def dashboard():
    return render_template('index.html')

@app.route('/statistics')
def statistics():
    return render_template('statistics.html')

# 5. API МАРШРУТИ (Для роботи датчиків та JS)
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
    # Віддає останні 20 записів для головного графіка
    history = SensorData.query.order_by(SensorData.timestamp.desc()).limit(20).all()
    return jsonify([entry.to_dict() for entry in reversed(history)])

@app.route('/api/history')
def get_history():
    # Новий маршрут для сторінки статистики (рахує середнє значення за годину)
    date_str = request.args.get('date')
    param = request.args.get('param')
    
    if not date_str or not param:
        return jsonify({"error": "Missing parameters"}), 400

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    # Групуємо записи по годинах і рахуємо середнє значення (для плавності графіка)
    results = db.session.query(
        func.strftime('%H', SensorData.timestamp).label('hour'),
        func.avg(getattr(SensorData, param)).label('value')
    ).filter(func.date(SensorData.timestamp) == target_date)\
     .group_by('hour').all()

    history_data = [{"hour": f"{r.hour}:00", "value": round(r.value, 2)} for r in results]
    return jsonify(history_data)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)