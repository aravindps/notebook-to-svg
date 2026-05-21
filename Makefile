.PHONY: setup test-cli serve test-api up down logs

REPO_ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
SCRIPT := $(REPO_ROOT)notebook-to-svg.sh
SERVER := $(REPO_ROOT)server/server.js
FIXTURE := $(REPO_ROOT)test-fixture.png
OUT_SVG := /tmp/notebook-test.svg
PORT ?= 8080

setup:
	@test -f $(REPO_ROOT).env || cp $(REPO_ROOT).env.example $(REPO_ROOT).env
	@echo "Ready. Edit $(REPO_ROOT).env to set TOKEN."

$(FIXTURE):
	magick -size 400x200 xc:white \
		-stroke black -strokewidth 3 \
		-draw "line 40,100 360,100" \
		-draw "bezier 80,140 120,60 280,60 320,140" \
		$(FIXTURE)

test-cli: $(FIXTURE)
	$(SCRIPT) $(FIXTURE) | head -5
	@echo "… OK (first lines of SVG shown)"

serve: setup
	NOTEBOOK_SCRIPT=$(SCRIPT) PORT=$(PORT) node $(SERVER)

test-api: $(FIXTURE) setup
	@set -a && . $(REPO_ROOT).env && set +a; \
	url="http://127.0.0.1:$(PORT)/"; \
	if [ -n "$$TOKEN" ]; then auth="-H Authorization: Bearer $$TOKEN"; else auth=""; fi; \
	curl -sf $$auth --data-binary @$(FIXTURE) "$$url" -o $(OUT_SVG) && \
	echo "Wrote $(OUT_SVG) ($$(wc -c < $(OUT_SVG) | tr -d ' ') bytes)"

up: setup
	docker compose -f $(REPO_ROOT)docker-compose.yml up --build -d

down:
	docker compose -f $(REPO_ROOT)docker-compose.yml down

logs:
	docker compose -f $(REPO_ROOT)docker-compose.yml logs -f
