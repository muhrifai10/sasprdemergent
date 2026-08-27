import asyncio
from types import SimpleNamespace

import server


class SettingsCollection:
    def __init__(self, document):
        self.document = document

    async def find_one(self, *args, **kwargs):
        return self.document


def test_openrouter_can_be_selected_from_runtime_settings(monkeypatch):
    monkeypatch.setattr(server, "OPENROUTER_API_KEY", "")
    monkeypatch.setattr(server, "DEEPSEEK_API_KEY", "deepseek-env-key")
    document = {
        "active_provider": "openrouter",
        "api_keys": {"openrouter": server.encrypt_provider_key("openrouter-dashboard-key")},
        "models": {"openrouter": "openai/gpt-4o-mini"},
    }
    monkeypatch.setattr(server, "db", SimpleNamespace(ai_provider_settings=SettingsCollection(document)))

    attempts = asyncio.run(server.build_ai_attempts())

    assert attempts[0] == (
        "openrouter",
        "openai/gpt-4o-mini",
        "openrouter-dashboard-key",
        server.OPENROUTER_BASE_URL,
    )


def test_auto_provider_prefers_available_openrouter_key(monkeypatch):
    monkeypatch.setattr(server, "NINEROUTER_API_KEY", "")
    monkeypatch.setattr(server, "OPENROUTER_API_KEY", "openrouter-env-key")
    monkeypatch.setattr(server, "DEEPSEEK_API_KEY", "deepseek-env-key")
    document = {"active_provider": "auto"}
    monkeypatch.setattr(server, "db", SimpleNamespace(ai_provider_settings=SettingsCollection(document)))

    attempts = asyncio.run(server.build_ai_attempts())

    assert attempts[0][0] == "openrouter"


def test_ninerouter_allows_a_blank_api_key_for_local_gateway(monkeypatch):
    monkeypatch.setattr(server, "NINEROUTER_API_KEY", "")
    document = {"active_provider": "9router"}
    monkeypatch.setattr(server, "db", SimpleNamespace(ai_provider_settings=SettingsCollection(document)))

    attempts = asyncio.run(server.build_ai_attempts())

    assert attempts[0] == ("9router", "Gemini", "", server.NINEROUTER_BASE_URL)
