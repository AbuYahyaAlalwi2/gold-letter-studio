PYTHON ?= python3
COMPOSE ?= docker compose

.PHONY: up down logs test config
up:
	@test -f .env || (cp .env.example .env && echo 'Edit .env and set secrets, then run make up again.' && exit 1)
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

test:
	$(PYTHON) -m pytest -q

config:
	$(COMPOSE) config
