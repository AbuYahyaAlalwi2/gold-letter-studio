FROM python:3.12-slim AS common

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY plugins/requirements.txt /tmp/plugin-requirements.txt
RUN pip install --no-cache-dir -r /tmp/plugin-requirements.txt

COPY plugins /app/plugins
COPY tools /app/tools
COPY security /app/security
COPY memory /app/memory

FROM common AS code-intel
CMD ["python", "-m", "plugins.code_intel.server"]

FROM common AS semgrep-scanner
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir "semgrep>=1.100,<2"
CMD ["python", "-m", "plugins.semgrep_scanner.server"]

FROM common AS persistent-memory
RUN pip install --no-cache-dir "mem0ai>=0.1,<1"
CMD ["python", "-m", "plugins.persistent_memory.server"]

FROM common AS security-guardrails
CMD ["python", "-m", "plugins.guardrails.server"]
