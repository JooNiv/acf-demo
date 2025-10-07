import React, { useState, useEffect } from "react";
import { BarChart } from '@mui/x-charts/BarChart';
import { CButton, CTable, CTextField } from '@cscfi/csc-ui-react'
import "./App.css"

function App() {
  const [username, setUsername] = useState("");
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(1);
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [isValid, setIsValid] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (username.trim() === ""){ 
      console.log("Username is required");
      setIsValid(false);
      return }
    if (status !== "" && status !== "Done!") return; // prevent multiple submissions
    
    setStatus("Submitting...");
    setIsValid(true);
    setResult(null);
    setImage(null);

    try {
      // Send the job request
      const res = await fetch("http://localhost:8000/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, q1: Number(q1), q2: Number(q2) }),
      });
      const data = await res.json();
      const { task_id } = data;

      setStatus("Waiting for result...");

      // Connect WebSocket for updates
      const ws = new WebSocket(`ws://localhost:8000/ws/${task_id}`);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.status === "queued") {
          setStatus("Your job is queued...");
        } else if (msg.status === "transpiled") {
          setStatus("Circuit transpiled");
          if (msg.image) {
            setImage(msg.image);
          }
        } else if (msg.status === "done") {
          setStatus("Done!");
          const entries = Object.entries(msg.result).sort(([a], [b]) => a.localeCompare(b));
          const map = new Map(entries);
          setResult(map);
          ws.close();
          fetchLeaderboard(); // refresh leaderboard after job done
        }
      };

      ws.onclose = () => console.log("WebSocket closed");
      ws.onerror = (err) => console.error("WebSocket error:", err);

    } catch (err) {
      console.error(err);
      setStatus("Error submitting job");
    }
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch("http://localhost:8000/leaderboard");
      const data = await res.json();
      const processed = data.map(entry => ({
        ...entry,
        score: (entry.result["00"] || 0) + (entry.result["11"] || 0)
      }));
      processed.sort((a, b) => b.score - a.score);
      setLeaderboard(processed);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  }

  async function handleChangeUsernameValue(e) {
    setUsername(e.target.value);
    if (e.target.value.trim() !== "") {
      setIsValid(true);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 500, margin: "auto" }}>
      
      <h1>Quantum Bell State Simulator</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Username:
          <CTextField
            value={username}
            valid={isValid}
            placeholder="Enter your username"
            validation="Username is required"
            onChangeValue={handleChangeUsernameValue}
            required
            style={{ marginLeft: 8 }}
          />
        </label>
        <div className="flex space-x-4">
        <label className="w-full">
          Qubit 1 index:
          <CTextField
            type="number"
            value={q1}
            onChangeValue={(e) => setQ1(e.target.value)}
            min="0"
            max="53"
            style={{ marginLeft: 8, width: 50 }}
          />
        </label>
        <label className="w-full">
          Qubit 2 index:
          <CTextField
            type="number"
            value={q2}
            onChangeValue={(e) => setQ2(e.target.value)}
            min="0"
            max="53"
            style={{ marginLeft: 8, width: 50 }}
          />
        </label>
        </div>
        <br /><br />
        <CButton
            type="submit"
            className='flex items-center py-2'
            onClick={(e) => handleSubmit(e)}
            loading={status !== "" && status !== "Done!"}
        >
            Execute Circuit
        </CButton>
        
      </form>

      <div style={{ marginTop: "2rem" }}>
        <h3>Status: {status}</h3>
        {image && (
          <div>
            <h4>Circuit Diagram:</h4>
            <img src={image} alt="Circuit Diagram" style={{ maxWidth: "100%" }} />
          </div>
        )}
        {result && (
          <div>
            <h4>Result:</h4>
            <div>
              Score: {result.get("00") + result.get("11")}
            </div>
            <BarChart
              barLabel="value"
              xAxis={[
                {
                  id: 'barCategories',
                  data: Array.from(result.keys()),
                },
              ]}
              series={[
                {
                  data: Array.from(result.values()),
                  label: "Count",
                  valueFormatter: (value) => value, // optional, for tooltip
                  showDataLabels: true, // <-- show value labels on bars
                  dataLabelFormatter: (value) => value, // <-- label is the value
                },
              ]}
              height={300}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2>Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p>No entries yet</p>
        ) : (
          <CTable>
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>User</th>
                <th>Qubits</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={i}>
                  <td>{entry.username}</td>
                  <td>
                    ({entry.q1}, {entry.q2})
                  </td>
                  <td>{entry.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </CTable>
        )}
      </div>
    </div>
  );
}

export default App;
