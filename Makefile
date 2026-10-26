.PHONY: setup backend frontend test ingest seed smoke

setup:
	./scripts/setup_backend.sh
	cd frontend && npm install

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/python -m pytest tests -q
	cd frontend && npx tsc -b && npm run lint

ingest:
	cd backend && .venv/bin/python -m rag.ingest data/usda.json --reset --core

seed:
	cd backend && .venv/bin/python scripts/seed_demo.py

smoke:
	cd backend && .venv/bin/python scripts/smoke_test.py $(ARGS)
