#!/usr/bin/env bash
# Exit on error
set -o errexit

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# Recolectar archivos estáticos de Django
python manage.py collectstatic --no-input

# Aplicar migraciones en la base de datos de producción
python manage.py migrate

# Sembrar datos base iniciales (Planes, Plantillas y Servicios)
python seed.py
