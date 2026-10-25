import os

for key, value in {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SERVICE_KEY": "service-key",
    "SUPABASE_ANON_KEY": "anon-key",
    "GEMINI_API_KEY": "gemini-key",
}.items():
    os.environ.setdefault(key, value)
