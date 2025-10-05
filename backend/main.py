from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from qiskit import QuantumCircuit, transpile
import asyncio
import uuid

from iqm.qiskit_iqm import IQMFakeAphrodite

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected = {}  # task_id -> websocket
task_queue = asyncio.Queue()

# ✅ In-memory leaderboard list
leaderboard = []  # Each entry: {"username": str, "q1": int, "q2": int, "result": dict}

pending_results = {}

async def run_simulation(task_id, username, q1, q2):
    backend = IQMFakeAphrodite()

    qc = QuantumCircuit(2, 2)
    qc.h(0)
    qc.cx(0, 1)
    qc.measure([0, 1], [0, 1])

    transpiled = transpile(qc, backend=backend, initial_layout=[q1,q2])

    job = backend.run(transpiled, shots=1024)
    result = job.result().get_counts()
    pending_results[task_id] = result

    ws = connected.get(task_id)
    if ws:
        await ws.send_json({"status": "done", "result": result})
        await ws.close()


    # ✅ Add to leaderboard
    leaderboard.append({
        "username": username,
        "q1": q1,
        "q2": q2,
        "result": result,
    })

    # ✅ Optionally cap leaderboard size
    if len(leaderboard) > 20:
        leaderboard.pop(0)  # keep only recent 20

    # Notify user
    ws = connected.get(task_id)
    if ws:
        await ws.send_json({"status": "done", "result": result})
        await ws.close()

@app.on_event("startup")
async def start_worker():
    asyncio.create_task(worker())

async def worker():
    while True:
        task = await task_queue.get()
        await run_simulation(**task)
        task_queue.task_done()

@app.post("/submit")
async def submit(job: dict):
    task_id = str(uuid.uuid4())
    await task_queue.put({"task_id": task_id, **job})
    return {"task_id": task_id}

@app.websocket("/ws/{task_id}")
async def ws_status(ws: WebSocket, task_id: str):
    await ws.accept()
    connected[task_id] = ws
    await ws.send_json({"status": "queued"})

    # If result is already ready, send immediately
    if task_id in pending_results:
        result = pending_results.pop(task_id)
        await ws.send_json({"status": "done", "result": result})
        await ws.close()


# ✅ New REST endpoint for leaderboard
@app.get("/leaderboard")
async def get_leaderboard():
    return leaderboard
