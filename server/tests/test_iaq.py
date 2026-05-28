import pytest


def test_iaq_excellent_when_all_ideal(app_module):
    assert app_module._calculate_iaq(co2=500, temp=22.0, hum=50.0) == 100


def test_iaq_zero_components_for_extreme_co2(app_module):
    iaq = app_module._calculate_iaq(co2=4000, temp=22.0, hum=50.0)
    assert iaq == int(round(0 * 0.4 + 100 * 0.3 + 100 * 0.3))


def test_iaq_returns_none_for_missing_input(app_module):
    assert app_module._calculate_iaq(None, 22.0, 50.0) is None
    assert app_module._calculate_iaq(500, None, 50.0) is None
    assert app_module._calculate_iaq(500, 22.0, None) is None


@pytest.mark.parametrize("co2,expected_co2_band", [
    (500, 100), (600, 100), (700, 80), (1000, 80),
    (1200, 60), (1500, 60), (1800, 40), (2000, 40),
    (2500, 20), (3000, 20), (3500, 0),
])
def test_iaq_co2_bands(app_module, co2, expected_co2_band):
    iaq = app_module._calculate_iaq(co2=co2, temp=22.0, hum=50.0)
    expected = int(round(expected_co2_band * 0.4 + 100 * 0.3 + 100 * 0.3))
    assert iaq == expected


@pytest.mark.parametrize("temp,expected_t_band", [
    (22, 100), (20, 100), (24, 100),
    (19, 80), (26, 80),
    (17, 60), (28, 60),
    (15, 40), (30, 40),
    (5, 20), (45, 20),
])
def test_iaq_temperature_bands(app_module, temp, expected_t_band):
    iaq = app_module._calculate_iaq(co2=500, temp=temp, hum=50.0)
    expected = int(round(100 * 0.4 + expected_t_band * 0.3 + 100 * 0.3))
    assert iaq == expected


@pytest.mark.parametrize("hum,expected_h_band", [
    (50, 100), (40, 100), (60, 100),
    (35, 80), (65, 80),
    (25, 60), (75, 60),
    (10, 30), (90, 30),
])
def test_iaq_humidity_bands(app_module, hum, expected_h_band):
    iaq = app_module._calculate_iaq(co2=500, temp=22.0, hum=hum)
    expected = int(round(100 * 0.4 + 100 * 0.3 + expected_h_band * 0.3))
    assert iaq == expected


def test_iaq_in_valid_range(app_module):
    iaq = app_module._calculate_iaq(co2=5000, temp=50.0, hum=95.0)
    assert 0 <= iaq <= 100
