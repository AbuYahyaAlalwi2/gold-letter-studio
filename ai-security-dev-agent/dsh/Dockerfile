FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc git && rm -rf /var/lib/apt/lists/*
COPY dsh/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && pip install --no-cache-dir semgrep==1.101.0
COPY dsh/app.py /app/app.py
COPY tools /app/tools
COPY security /app/security
COPY memory /app/memory
RUN useradd --system --uid 10001 --create-home appuser && chown -R appuser:appuser /app
USER 10001
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
