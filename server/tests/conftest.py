import os
import sys
import tempfile
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "test_climate.db"
    monkeypatch.setenv("SQLALCHEMY_DATABASE_URI", f"sqlite:///{db_file}")
    monkeypatch.setenv("DEVICE_TOKEN", "test-token-xyz")

    if "app" in sys.modules:
        del sys.modules["app"]
    import app as app_module

    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


@pytest.fixture()
def app_module(tmp_path, monkeypatch):
    db_file = tmp_path / "test_climate.db"
    monkeypatch.setenv("SQLALCHEMY_DATABASE_URI", f"sqlite:///{db_file}")
    monkeypatch.setenv("DEVICE_TOKEN", "test-token-xyz")

    if "app" in sys.modules:
        del sys.modules["app"]
    import app as mod
    return mod


VALID_HEADERS = {
    "Content-Type": "application/json",
    "X-Device-Token": "test-token-xyz",
}
