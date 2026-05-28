import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///climate.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

DEVICE_TOKEN = os.environ.get("DEVICE_TOKEN", "esp32-climate-secret-2026")

db = SQLAlchemy(app)


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SensorData(db.Model):
    __tablename__ = 'sensor_data'

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=_utcnow, index=True)
    temp = db.Column(db.Float, nullable=False)
    hum = db.Column(db.Float, nullable=False)
    co2 = db.Column(db.Integer, nullable=False)
    iaq = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        iaq_val = self.iaq
        if iaq_val is None:
            iaq_val = _calculate_iaq(self.co2, self.temp, self.hum)
        return {
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "temp": self.temp,
            "hum": self.hum,
            "co2": self.co2,
            "iaq": iaq_val,
        }


def _calculate_iaq(co2, temp, hum):
    if co2 is None or temp is None or hum is None:
        return None

    if co2 <= 600:
        c = 100
    elif co2 <= 1000:
        c = 80
    elif co2 <= 1500:
        c = 60
    elif co2 <= 2000:
        c = 40
    elif co2 <= 3000:
        c = 20
    else:
        c = 0

    if 20 <= temp <= 24:
        t = 100
    elif 18 <= temp <= 26:
        t = 80
    elif 16 <= temp <= 28:
        t = 60
    elif 14 <= temp <= 30:
        t = 40
    else:
        t = 20

    if 40 <= hum <= 60:
        h = 100
    elif 30 <= hum <= 70:
        h = 80
    elif 20 <= hum <= 80:
        h = 60
    else:
        h = 30

    return int(round(c * 0.4 + t * 0.3 + h * 0.3))


def _validate_payload(data):
    if not data:
        return False, "Empty payload", None

    try:
        temp = float(data.get('temp'))
        hum = float(data.get('hum'))
        co2 = int(data.get('co2'))
    except (TypeError, ValueError):
        return False, "Invalid types for temp/hum/co2", None

    if not (-40.0 <= temp <= 80.0):
        return False, f"temp out of range: {temp}", None
    if not (0.0 <= hum <= 100.0):
        return False, f"hum out of range: {hum}", None
    if not (300 <= co2 <= 10000):
        return False, f"co2 out of range: {co2}", None

    cleaned = {"temp": temp, "hum": hum, "co2": co2}

    iaq_raw = data.get('iaq')
    iaq_val = None
    if iaq_raw is not None:
        try:
            tmp = int(iaq_raw)
            if 0 <= tmp <= 100:
                iaq_val = tmp
        except (TypeError, ValueError):
            iaq_val = None
    if iaq_val is None:
        iaq_val = _calculate_iaq(co2, temp, hum)
    cleaned['iaq'] = iaq_val

    cleaned['ts'] = None
    ts_raw = data.get('ts')
    if ts_raw is not None:
        try:
            ts_i = int(ts_raw)
            if 1704067200 <= ts_i <= 4102444800:
                cleaned['ts'] = ts_i
        except (TypeError, ValueError):
            pass

    return True, None, cleaned


def _ensure_schema():
    with db.engine.connect() as conn:
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(sensor_data)"))]
        if cols and 'iaq' not in cols:
            conn.execute(text("ALTER TABLE sensor_data ADD COLUMN iaq INTEGER"))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_sensor_data_timestamp ON sensor_data (timestamp)"
        ))
        conn.commit()


with app.app_context():
    db.create_all()
    _ensure_schema()


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
    token = request.headers.get('X-Device-Token', '')
    if not token or token != DEVICE_TOKEN:
        return jsonify({"status": "error", "error": "Unauthorized"}), 401

    data = request.get_json(silent=True)
    ok, err, cleaned = _validate_payload(data)
    if not ok:
        return jsonify({"status": "error", "error": err}), 400

    if cleaned.get('ts'):
        ts_dt = datetime.fromtimestamp(cleaned['ts'], tz=timezone.utc).replace(tzinfo=None)
    else:
        ts_dt = _utcnow()

    new_entry = SensorData(
        timestamp=ts_dt,
        temp=cleaned['temp'],
        hum=cleaned['hum'],
        co2=cleaned['co2'],
        iaq=cleaned['iaq'],
    )
    db.session.add(new_entry)
    db.session.commit()
    return jsonify({"status": "success"}), 200


@app.route('/data')
def get_data():
    history = SensorData.query.order_by(SensorData.timestamp.desc()).limit(20).all()
    return jsonify([entry.to_dict() for entry in reversed(history)])


@app.route('/api/history')
def get_history():
    start_utc_str = request.args.get('start')
    end_utc_str = request.args.get('end')

    if not start_utc_str or not end_utc_str:
        return jsonify({"error": "Missing parameters"}), 400

    try:
        start_dt = datetime.strptime(start_utc_str[:19], '%Y-%m-%dT%H:%M:%S')
        end_dt = datetime.strptime(end_utc_str[:19], '%Y-%m-%dT%H:%M:%S')
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    records = SensorData.query.filter(
        SensorData.timestamp >= start_dt,
        SensorData.timestamp < end_dt
    ).order_by(SensorData.timestamp.asc()).all()

    return jsonify([r.to_dict() for r in records])


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
