#!/bin/bash
# Azure App Service "Startup Command" shu faylni ishga tushiradi:
#   bash startup.sh
#
# Migratsiya har deploy'da avtomatik bajariladi (yangi jadval/ustun
# qo'shilganda qo'lda Kudu SSH'ga kirish shart bo'lmasin uchun), so'ng
# ASGI server ishga tushadi. `set -e` — migratsiya muvaffaqiyatsiz bo'lsa
# eski (buzilgan) kod bilan server ishga tushib qolmaydi.
set -e

echo "Migratsiyalarni qo'llash..."
python -m alembic upgrade head

echo "Serverni ishga tushirish..."
exec gunicorn app.main:app \
  --bind=0.0.0.0:8000 \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 2 \
  --timeout 600
