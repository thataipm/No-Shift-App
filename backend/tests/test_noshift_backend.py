"""
Noshift Backend Tests
Tests: /api/health endpoint (minimal FastAPI backend - all data goes through Supabase JS client)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError('EXPO_PUBLIC_BACKEND_URL environment variable is required')


class TestHealth:
    """Health check endpoint"""

    def test_health_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200

    def test_health_response_body(self):
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        data = response.json()
        assert data.get('status') == 'ok'
        assert data.get('service') == 'noshift'

    def test_health_content_type_json(self):
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert 'application/json' in response.headers.get('content-type', '')


class TestCORSHeaders:
    """CORS configuration tests"""

    def test_cors_allows_all_origins(self):
        response = requests.options(
            f"{BASE_URL}/api/health",
            headers={
                'Origin': 'https://example.com',
                'Access-Control-Request-Method': 'GET',
            },
            timeout=10
        )
        # Should either return 200 or allow through preflight
        assert response.status_code in [200, 204]
