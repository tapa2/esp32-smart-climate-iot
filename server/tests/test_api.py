import json
from .conftest import VALID_HEADERS


def test_update_without_token_returns_401(client):
    resp = client.post("/update", json={"temp": 22, "hum": 50, "co2": 800})
    assert resp.status_code == 401
    body = resp.get_json()
    assert body["status"] == "error"
    assert body["error"] == "Unauthorized"


def test_update_with_wrong_token_returns_401(client):
    resp = client.post(
        "/update",
        json={"temp": 22, "hum": 50, "co2": 800},
        headers={"X-Device-Token": "wrong-token"},
    )
    assert resp.status_code == 401


def test_update_invalid_co2_returns_400(client):
    resp = client.post(
        "/update",
        json={"temp": 22, "hum": 50, "co2": -999},
        headers=VALID_HEADERS,
    )
    assert resp.status_code == 400
    assert "co2 out of range" in resp.get_json()["error"]


def test_update_success(client):
    resp = client.post(
        "/update",
        json={"temp": 22.5, "hum": 50, "co2": 800, "iaq": 85, "ts": 1748441000},
        headers=VALID_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "success"}


def test_data_endpoint_returns_recent_records(client):
    for co2 in (500, 800, 1100):
        client.post(
            "/update",
            json={"temp": 22, "hum": 50, "co2": co2},
            headers=VALID_HEADERS,
        )
    resp = client.get("/data")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) == 3
    co2_values = [d["co2"] for d in data]
    assert co2_values == [500, 800, 1100]
    for record in data:
        assert record["iaq"] is not None


def test_history_missing_params_returns_400(client):
    resp = client.get("/api/history")
    assert resp.status_code == 400


def test_history_returns_records_in_range(client):
    client.post(
        "/update",
        json={"temp": 22, "hum": 50, "co2": 750, "ts": 1748441000},
        headers=VALID_HEADERS,
    )
    resp = client.get(
        "/api/history?start=2025-05-28T00:00:00&end=2026-05-29T00:00:00"
    )
    assert resp.status_code == 200
    records = resp.get_json()
    assert len(records) >= 1
    assert all("iaq" in r for r in records)


def test_schema_has_iaq_column_and_index(app_module):
    from sqlalchemy import text
    with app_module.app.app_context():
        with app_module.db.engine.connect() as conn:
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(sensor_data)"))]
            assert "iaq" in cols
            assert "timestamp" in cols
            idxs = [r[1] for r in conn.execute(text("PRAGMA index_list(sensor_data)"))]
            assert any("timestamp" in i for i in idxs)
