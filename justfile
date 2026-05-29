# type `just` to see this list
default:
    @just --list

# run Django + Radicale together (main dev command)
[parallel]
dev: runserver radicale npm-dev

# start the Django dev server
runserver:
    uv run python src/manage.py runserver

# start the Radicale CalDAV server (phone connects to this)
radicale:
    uv run radicale --config radicale.conf

# create a Radicale user (prompts for username and password)
radicale-adduser:
    uv run python scripts/radicale_adduser.py

# run the test suite (pass extra args, e.g. `just test -k auth`)
test *ARGS:
    uv run pytest {{ARGS}}

migrate:
    uv run python src/manage.py migrate

makemigrations:
    uv run python src/manage.py makemigrations

createsuperuser:
    uv run python src/manage.py createsuperuser

npm-dev:
    cd frontend && npm run dev

npm-install:
    cd frontend && npm install