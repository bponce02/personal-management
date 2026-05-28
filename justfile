# type `just` to see this list
default:
    @just --list

# start the Django dev server
runserver:
    uv run python src/manage.py runserver

# run the test suite (pass extra args, e.g. `just test -k auth`)
test *ARGS:
    uv run pytest {{ARGS}}

migrate:
    uv run python src/manage.py migrate

makemigrations:
    uv run python src/manage.py makemigrations

createsuperuser:
    uv run python src/manage.py createsuperuser
