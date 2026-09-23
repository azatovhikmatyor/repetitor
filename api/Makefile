.PHONY: install db-up db-down migrate revision run test lint seed

install:
	python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt

db-up:
	docker compose up -d db

db-down:
	docker compose down

migrate:
	alembic upgrade head

revision:
	alembic revision --autogenerate -m "$(m)"

run:
	uvicorn app.main:app --reload --port 8000

test:
	pytest -q

lint:
	ruff check app tests && ruff format --check app tests

seed:
	python -m app.cli seed-demo
