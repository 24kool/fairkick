from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def sample_payload():
    return {
        "players": [
            {"id": "1", "name": "Alex", "rating": 3},
            {"id": "2", "name": "Jordan", "rating": 3},
            {"id": "3", "name": "Casey", "rating": 2},
            {"id": "4", "name": "Robin", "rating": 1},
        ],
        "green_captain_id": "1",
        "orange_captain_id": "2",
    }


def test_generate_success():
    response = client.post("/generate", json=sample_payload())
    assert response.status_code == 200
    body = response.json()
    assert sorted(player["id"] for player in body["green"] + body["orange"]) == ["1", "2", "3", "4"]
    assert body["green_total"] >= 0 and body["orange_total"] >= 0
    assert body["rating_gap"] >= 0
    assert abs(len(body["green"]) - len(body["orange"])) <= 1
    assert len(body["green"]) == len(body["orange"])


def test_captains_must_differ():
    payload = sample_payload()
    payload["orange_captain_id"] = "1"
    response = client.post("/generate", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Captains must be different players"
