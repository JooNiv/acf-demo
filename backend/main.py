from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import matplotlib
from qiskit import QuantumCircuit, transpile
import asyncio
import uuid
from time import sleep
from iqm.qiskit_iqm import IQMFakeAphrodite

from qiskit.converters import circuit_to_dag, dag_to_circuit
from collections import OrderedDict
import logging
import io
import base64
matplotlib.use('Agg')
import matplotlib.pyplot as plt
backend = IQMFakeAphrodite()

class RootOnlyFilter(logging.Filter):
    def filter(self, record):
        return record.name == "root"

handler = logging.StreamHandler()
handler.addFilter(RootOnlyFilter())

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[handler],
)

logging.getLogger().propagate = False

# Create a logger instance

logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def remove_idle_qwires(circ):
    dag = circuit_to_dag(circ)

    idle_wires = list(dag.idle_wires())
    for w in idle_wires:
        dag._remove_idle_wire(w)
        dag.qubits.remove(w)

    dag.qregs = OrderedDict()

    return dag_to_circuit(dag)


connected = {}  # task_id -> websocket
task_queue = asyncio.Queue()

transpile_queue = asyncio.Queue()

# In-memory leaderboard list
leaderboard = []  # Each entry: {"username": str, "q1": int, "q2": int, "result": dict}

pending_results = {}
pending_transpiled = {}
pending_statuses = {}


async def transpile_circuit(task_id, username, q1, q2):
    # Append a 'transpiling' entry to pending_transpiled so late-connecting
    # clients still see the intermediate status. Use a list to preserve
    # multiple messages (e.g. 'transpiling' then 'transpiled').
    pending_transpiled.setdefault(task_id, []).append({"status": "transpiling"})

    # Try to send an immediate 'transpiling' update if the websocket is
    # already connected. Failures are non-fatal because the pending list
    # will be delivered when the client connects.
    ws = connected.get(task_id)
    if ws:
        try:
            await ws.send_json({"status": "transpiling"})
        except Exception as e:
            logging.info(f"Could not send 'transpiling' to {task_id}: {e}")
    qc = QuantumCircuit(2, 2)
    qc.h(0)
    qc.cx(0, 1)
    qc.measure([0, 1], [0, 1])

    transpiled = transpile(qc, backend=backend, initial_layout=[q1, q2])
    new_transpiled = remove_idle_qwires(transpiled)
    logging.info(f"Transpiled circuit from task: {task_id}")

    msg = {"status": "transpiled"}

    try:
        fig = new_transpiled.draw(output='mpl')
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        img_b64 = base64.b64encode(buf.getvalue()).decode('ascii')
        msg["image"] = f"data:image/png;base64,{img_b64}"

        logging.info(f"Rendered circuit image for task: {task_id}")
    except Exception as e:
        # if rendering fails, still send text
        logging.info(f"Error rendering circuit image for task {task_id}: {e}")
        msg["image_error"] = str(e)

    # Append the final transpiled payload (may include the rendered image).
    pending_transpiled.setdefault(task_id, []).append(msg)

    # If the client is already connected, try to send the final message now.
    ws = connected.get(task_id)
    if ws:
        try:
            await ws.send_json(msg)
        except Exception as e:
            logging.info(f"Could not send 'transpiled' to {task_id}: {e}")
    return transpiled

async def run_simulation(task_id, username, q1, q2, transpiled):
    # Record that the task is executing so late-connecting clients will
    # receive the 'executing' update.
    pending_statuses.setdefault(task_id, []).append({"status": "executing"})

    ws = connected.get(task_id)
    if ws:
        try:
            await ws.send_json({"status": "executing"})
        except Exception as e:
            logging.info(f"Could not send 'executing' to {task_id}: {e}")
    logging.info(f"Here, starting run: {task_id}")
    job = backend.run(transpiled, shots=1000)
    result = job.result().get_counts()
    pending_results[task_id] = result

    
    logging.info(f"Finished circuit from task: {task_id}")
    if ws:
        try:
            await ws.send_json({"status": "done", "result": result})
            await ws.close()
        except Exception as e:
            logging.info(f"Could not send 'done' to {task_id}: {e}")

    # Add to leaderboard
    leaderboard.append(
        {
            "username": username,
            "q1": q1,
            "q2": q2,
            "result": result,
        }
    )

    # Notify user
    ws = connected.get(task_id)
    if ws:
        try:
            await ws.send_json({"status": "done", "result": result})
            await ws.close()
        except Exception as e:
            logging.info(f"Could not resend 'done' to {task_id}: {e}")


@app.on_event("startup")
async def start_worker():
    asyncio.create_task(worker())
    asyncio.create_task(transpile_worker())


async def worker():
    while True:
        task = await task_queue.get()
        await run_simulation(**task)
        task_queue.task_done()


async def transpile_worker():
    while True:
        task = await transpile_queue.get()

        transpiled = await transpile_circuit(**task)

        task_id = task["task_id"]
        q1 = task["q1"]
        q2 = task["q2"]
        username = task["username"]
        await task_queue.put({"task_id": task_id, "username": username, "q1": q1, "q2": q2, "transpiled": transpiled})
        transpile_queue.task_done()


@app.post("/submit")
async def submit(job: dict):
    task_id = str(uuid.uuid4())
    await transpile_queue.put({"task_id": task_id, **job})
    return {"task_id": task_id}


@app.websocket("/ws/{task_id}")
async def ws_status(ws: WebSocket, task_id: str):
    # Accept the websocket. After await ws.accept() the connection is established.
    await ws.accept()

    # Store the active websocket for this task id so background workers can send updates.
    connected[task_id] = ws

    try:
        # Tell the client the job is queued (this is safe to send immediately after accept).
        await ws.send_json({"status": "queued"})

        # If there are any pending transpile messages (e.g. 'transpiling', 'transpiled'),
        # send them all in order. Use pop to clear after sending.
        if task_id in pending_transpiled:
            msgs = pending_transpiled.pop(task_id)
            for m in msgs:
                try:
                    await ws.send_json(m)
                except Exception as e:
                    logging.info(f"Could not send pending transpile message for {task_id}: {e}")

        # If there are any other pending status messages (e.g. 'executing'), send them too.
        if task_id in pending_statuses:
            s_msgs = pending_statuses.pop(task_id)
            for s in s_msgs:
                try:
                    await ws.send_json(s)
                except Exception as e:
                    logging.info(f"Could not send pending status message for {task_id}: {e}")

        # If the result is already ready, send it and close the connection.
        if task_id in pending_results:
            result = pending_results.pop(task_id)
            await ws.send_json({"status": "done", "result": result})
            await ws.close()
            return

        # Keep the connection open until the client disconnects. We don't need to
        # continuously poll client_state — awaiting receive will error when the
        # client disconnects and we'll clean up in finally.
        while True:
            try:
                await ws.receive_text()
            except Exception:
                # client disconnected or error occurred — break out and cleanup
                break
    finally:
        # Ensure we remove references to the websocket to avoid leaks.
        if connected.get(task_id) is ws:
            connected.pop(task_id, None)


# Endpoint for leaderboard
@app.get("/leaderboard")
async def get_leaderboard():
    return leaderboard
