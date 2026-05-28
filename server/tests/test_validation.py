import pytest


def test_empty_payload_rejected(app_module):
    ok, err, cleaned = app_module._validate_payload(None)
    assert ok is False
    assert "Empty" in err


def test_missing_fields_rejected(app_module):
    ok, err, _ = app_module._validate_payload({"temp": 22})
    assert ok is False
    assert "Invalid types" in err


def test_co2_out_of_range_rejected(app_module):
    ok, err, _ = app_module._validate_payload({"temp": 22, "hum": 50, "co2": -100})
    assert ok is False
    assert "co2 out of range" in err

    ok, err, _ = app_module._validate_payload({"temp": 22, "hum": 50, "co2": 99999})
    assert ok is False


def test_temp_out_of_range_rejected(app_module):
    ok, err, _ = app_module._validate_payload({"temp": -100, "hum": 50, "co2": 500})
    assert ok is False
    assert "temp out of range" in err


def test_hum_out_of_range_rejected(app_module):
    ok, err, _ = app_module._validate_payload({"temp": 22, "hum": 150, "co2": 500})
    assert ok is False
    assert "hum out of range" in err


def test_valid_payload_accepted(app_module):
    ok, err, cleaned = app_module._validate_payload(
        {"temp": 22.5, "hum": 50.0, "co2": 800}
    )
    assert ok is True
    assert err is None
    assert cleaned["temp"] == 22.5
    assert cleaned["hum"] == 50.0
    assert cleaned["co2"] == 800
    assert cleaned["iaq"] is not None
    assert 0 <= cleaned["iaq"] <= 100


def test_iaq_passthrough_when_in_range(app_module):
    ok, _, cleaned = app_module._validate_payload(
        {"temp": 22, "hum": 50, "co2": 800, "iaq": 73}
    )
    assert ok is True
    assert cleaned["iaq"] == 73


def test_iaq_recalculated_when_invalid(app_module):
    ok, _, cleaned = app_module._validate_payload(
        {"temp": 22, "hum": 50, "co2": 800, "iaq": 999}
    )
    assert ok is True
    assert 0 <= cleaned["iaq"] <= 100


def test_valid_ts_accepted(app_module):
    ok, _, cleaned = app_module._validate_payload(
        {"temp": 22, "hum": 50, "co2": 800, "ts": 1748441000}
    )
    assert ok is True
    assert cleaned["ts"] == 1748441000


def test_zero_ts_treated_as_unavailable(app_module):
    ok, _, cleaned = app_module._validate_payload(
        {"temp": 22, "hum": 50, "co2": 800, "ts": 0}
    )
    assert ok is True
    assert cleaned["ts"] is None
