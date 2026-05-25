# type `just` to see this list
default:
    @just --list

runserver:
    uv run python src/manage.py runserver

migrate:
    uv run python src/manage.py migrate

makemigrations:
    uv run python src/manage.py makemigrations

createsuperuser:
    uv run python src/manage.py createsuperuser
