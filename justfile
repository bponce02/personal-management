# type `just` to see this list
default:
    @just --list

# run Django server + Tailwind watcher together (main dev command)
[parallel]
dev: tailwind runserver

# start the Tailwind CSS watcher
tailwind:
    uv run python src/manage.py tailwind start

# start the Django dev server
runserver:
    uv run python src/manage.py runserver

# format Django templates with djlint
fmt:
    uv run djlint src/core/templates --reformat --profile django

migrate:
    uv run python src/manage.py migrate

makemigrations:
    uv run python src/manage.py makemigrations

createsuperuser:
    uv run python src/manage.py createsuperuser
