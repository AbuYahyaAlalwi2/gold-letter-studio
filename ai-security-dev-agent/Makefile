DOCKER_COMPOSE := docker compose

.PHONY: up down build logs ps

up:
	@cp -n .env.example .env 2>/dev/null || true
	$(DOCKER_COMPOSE) up --build -d

logs:
	$(DOCKER_COMPOSE) logs -f

ps:
	$(DOCKER_COMPOSE) ps

down:
	$(DOCKER_COMPOSE) down -v
