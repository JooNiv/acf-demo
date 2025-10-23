# CSC ACF Quantum Demo

Quantum entanglement demo game for CSC ACF conference

# Running locally

## Docker

```bash
docker compose up --build
```

## UV and NPM

### Install backend depenencies

Recommended way to install python dependencies is via uv.
Uv can be installed by running:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

With uv one can install dependencies with:

```bash
cd backend
uv sync #or 'uv sync --no-dev' for no dev dependencies
```

### Install frontend dependencies

```bash
cd frontend
npm install
```

### Running the whole application

#### Via provided bash script

```bash
#at project root
bash start.sh
```

#### Manually

Backend:

```bash
cd backend
uv run fastapi run main.py --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```