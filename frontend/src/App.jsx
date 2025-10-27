import React, { useState, useEffect, useRef, use } from "react";
import { BarChart } from '@mui/x-charts/BarChart';
import { CButton, CTable, CTextField, CSteps, CStep, CProgressBar, CPagination } from '@cscfi/csc-ui-react'
import "./App.css"

function App() {
  const [username, setUsername] = useState("");
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(1);
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState("");
  const [isDone, setIsDone] = useState(0);
  const [result, setResult] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isValid, setIsValid] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [showQubits, setShowQubits] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [options, setOptions] = useState({
    itemCount: leaderboard.length,
    itemsPerPage: 5,
    currentPage: 1,
    pageSizes: [5, 10, 15, 20, 40]
  });
  const resultsRef = useRef(null);
  const selectedRef = useRef(null);
  const steps = {
    "queued": 1,
    "transpiling": 2,
    "transpiled": 3,
    "executing": 4,
    "done": 5,
  }

  const adminUsername = import.meta.env.VITE_adminUsername || "admin_csc_acf";
  const qubitTogglePassword = import.meta.env.VITE_qubitTogglePassword || "supersecretpassword";

  const isInitialLoad = useRef(true);

  useEffect(() => {
    const cookies = document.cookie.split(";").map(cookie => cookie.trim());
    const adminCookie = cookies.find(cookie => cookie.startsWith(`${adminUsername}=true`));
    if (adminCookie) {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    {
      const params = new URLSearchParams(window.location.search);
      const adminParam = params.get(adminUsername);
      if (adminParam === qubitTogglePassword) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        document.cookie = `${adminUsername}=true; expires=${expires.toUTCString()}; path=/`;
        window.location.href = "/";
      }
    }
  }, [])

  useEffect(() => {
    async function fetchShowQubits() {
      try {
        const res = await fetch("http://localhost:8000/show_qubits");
        const data = await res.json();
        setShowQubits(data);
      } catch (err) {
        console.error("Failed to fetch showQubits:", err);
      }
    }

    fetchShowQubits();
  }, []);

  const handleSetShowQubits = async () => {
    try {
      const res = await fetch("http://localhost:8000/show_qubits", {
        method: "POST",
      });
      const data = await res.json();
      console.log("Toggled showQubits to:", data);
      setShowQubits(data);
    } catch (err) {
      console.error("Failed to toggle showQubits:", err);
    }
  };

  // CPagination calls onChangeValue with the new options object.
  const onPageChange = (newOptions) => {
    setOptions(prev => ({ ...prev, ...newOptions }));

    // Skip scrolling on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    const thisElement = document.getElementById("leaderboard");
    if (thisElement) {
      const yOffset = -80; // Account for navbar
      const y = thisElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Keep pagination itemCount in sync with number of leaderboard entries
  useEffect(() => {
    setOptions(prev => ({ ...prev, itemCount: leaderboard.length }));
  }, [leaderboard]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (username.trim() === "") {
      setIsValid(false);
      return
    }
    if (status !== "" && status !== "done") return; // prevent multiple submissions

    setStatus("queued");
    setSubmitted(true);
    setIsValid(true);
    setResult(null);
    setImage(null);
    setIsDone(0);

    try {
      // Send the job request
      const res = await fetch("http://localhost:8000/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, q1: Number(q1), q2: Number(q2) }),
      });
      const data = await res.json();
      const { task_id } = data;

      //setStatus("Waiting for result...");

      // Connect WebSocket for updates
      const ws = new WebSocket(`ws://localhost:8000/ws/${task_id}`);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log(msg?.status)
        if (msg.status === "done") {
          const entries = Object.entries(msg.result).sort(([a], [b]) => a.localeCompare(b));
          const map = new Map(entries);
          setResult(map);
          setStatus("done");
          setIsDone(1)
          ws.close();
          fetchLeaderboard(); // refresh leaderboard after job done
        }
        else if (msg.status === "transpiled") {
          if (msg.image) {
            setImage(msg.image);
          }
          setStatus("transpiled");
        }
        else {
          setStatus(prev => (prev === "done" ? prev : msg.status));
        }
      };


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
    <div className="flex flex-col lg:flex-row gap-12 p-6 mb-12">
      <div className="flex flex-col gap-6 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          <div id="input" className="col-span-1 border border-gray-200 p-4 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold">Choose Your Qubits</h2>
            <form onSubmit={handleSubmit} className="mt-4">
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
                  Control Qubit:
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
                  Target Qubit:
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
              <CButton
                type="button"
                className='flex items-center py-2'
                onClick={(e) => handleSubmit(e)}
                loading={status !== "" && status !== "done"}
              >
                Execute On Q50
              </CButton>
              {submitted && (<>
                <CSteps className="mt-6 font-semibold" v-model="step" value={steps[status]}>
                  <CStep>Queued</CStep>

                  <CStep>Transpiling</CStep>

                  <CStep>Transpiled</CStep>

                  <CStep>Executing</CStep>

                  <CStep>Done</CStep>

                </CSteps>
              </>
              )}

            </form>
          </div>

          <div id="bell-circuit" className="h-min col-span-1 border border-gray-200 p-4 rounded-lg shadow-lg">
            <p className="text-2xl font-bold">Optimal circuit</p>
            <img src="./src/bell-circuit.png" alt="Bell Circuit" />
          </div>
        </div>


        {(result) &&
          <div id="score" ref={resultsRef} className="flex flex-col gap-4 border border-gray-200 p-4 rounded-lg shadow-lg">
            <div className="">
              <h4 className="text-2xl font-bold">Score:</h4>
            </div>
            <div>

              <div>
                {(() => {
                  const display = result;
                  const val00 = display.get("00") || 0;
                  const val11 = display.get("11") || 0;
                  return (
                    <>
                      <p className="ml-1">{val00 + val11}/1000</p>
                      <CProgressBar hideDetails value={(val00 + val11) / 10} />
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        }

        <div id="results" className="grid grid-cols-1 sm:grid-cols-1 gap-6">
          {result && (
            <div className="col-span-1 border border-gray-200 p-4 rounded-lg shadow-lg">
              <h4 className="text-2xl font-bold">Result Distribution:</h4>
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
          {image && (
            <div className="col-span-1 h-min border border-gray-200 p-4 rounded-lg shadow-lg">
              <h4 className="text-2xl font-bold">Executed circuit:</h4>
              <img src={image} alt="Circuit Diagram" />
            </div>
          )}
        </div>
      </div>
      <div className="w-full lg:w-[70%] 2xl:w-[100%] h-min">
        <div id="leaderboard" className="h-min border border-gray-200 p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Leaderboard</h2>
            <div className="flex">
              {isAdmin && (<CButton onClick={handleSetShowQubits} className="ml-2 mb-2">Show Qubits</CButton>)}
              <CButton onClick={fetchLeaderboard} className="ml-2 mb-2">Refresh</CButton>
            </div>
          </div>
          {leaderboard.length === 0 ? (
            <p>No entries yet</p>
          ) : (
            <>
              <CPagination
                value={options}
                //hideDetails
                onChangeValue={onPageChange}
                control
              />
              <CTable>
                <table border="1" cellPadding="5">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>User</th>
                      {showQubits && (<th>Qubits</th>)}
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.slice((options.currentPage - 1) * options.itemsPerPage, (options.currentPage - 1) * options.itemsPerPage + options.itemsPerPage).map((entry, i) => {
                      const globalIndex = (options.currentPage - 1) * options.itemsPerPage + i;
                      const isSelected = selectedIndex === globalIndex;
                      return (
                        <tr
                          key={globalIndex}
                          onClick={() => {
                            // Build a Map in the same shape as `result` (Map of keys to counts)
                            const entries = Object.entries(entry.result).sort(([a], [b]) => a.localeCompare(b));
                            const map = new Map(entries);
                            setSelectedResult(map);
                            setSelectedIndex(globalIndex);
                            setSelectedImage(entry.image);
                            // scroll to results
                            selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={isSelected ? 'bg-blue-100 cursor-pointer' : 'cursor-pointer'}
                        >
                          <td>{globalIndex + 1}</td>
                          <td>{entry.username}</td>
                          {showQubits && (
                            <td>
                              ({entry.q1}, {entry.q2})
                            </td>
                          )}
                          <td>{entry.score}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CTable>

            </>
          )}
        </div>
        {/* Selected run bar plot */}
        {(selectedResult) && (
          <div ref={selectedRef} className="w-full mt-4 border border-gray-200 p-4 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Selected Run - Result Distribution</h3>
              <div>
                <CButton onClick={() => { setSelectedResult(null); setSelectedIndex(null); }} className="ml-2">Clear</CButton>
              </div>
            </div>
            <div className="mt-4">
              <BarChart
                barLabel="value"
                xAxis={[{ id: 'selBarCats', data: Array.from(selectedResult.keys()) }]}
                series={[{ data: Array.from(selectedResult.values()), label: 'Count', valueFormatter: v => v, showDataLabels: true, dataLabelFormatter: v => v }]}
                height={260}
              //colors={['#006778ff']}
              />
            </div>
            {selectedImage && (
              <div className="mt-4">
                <h4 className="text-xl font-semibold">Selected Run - Executed circuit:</h4>
                <img src={selectedImage} alt="Circuit Diagram" />
              </div>
            )}
          </div>
        )}
      </div>



      {/* Floating mobile button: bottom-left, only on small screens */}
      {status === "done" && result && (
        <CButton
          onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="fixed bottom-4 left-6 z-50 sm:hidden text-white shadow-lg"
          aria-label="Scroll to results"
        >
          <p className="">Results</p>
        </CButton>
      )}
    </div>
  );
}

export default App;
