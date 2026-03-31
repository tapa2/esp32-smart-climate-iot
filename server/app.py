from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

latest_data = {"temp": 0.0, "hum": 0, "co2": 0}

@app.route('/')
def home():
    return "<h1>Сервер працює!</h1><p><a href='/dashboard'>Перейти до дашборду</a></p>"

@app.route('/update', methods=['POST'])
def update_data():
    global latest_data
    data = request.get_json()
    if data:
        latest_data.update(data)
        return jsonify({"status": "success"}), 200
    return jsonify({"status": "error"}), 400

@app.route('/data')
def get_data():
    return jsonify(latest_data)

@app.route('/dashboard')
def dashboard():
    # Flask автоматично шукає в папці templates/
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)