# YatraSetu AI: one container that serves the traveller site, the officials' dashboard and the API.
#   docker build -t yatrasetu .
#   docker run -p 8000:8000 -e EDITOR_PASSWORD=... -e APPROVER_PASSWORD=... yatrasetu
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
COPY scripts scripts
RUN python scripts/seed_demo.py && useradd --create-home yatra && chown -R yatra /srv
USER yatra
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
