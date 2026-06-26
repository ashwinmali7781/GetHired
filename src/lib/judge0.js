/**
 * Code execution — hybrid, no external API needed for JS/Python:
 *
 *  JavaScript  → Web Worker in the browser (instant, no server)
 *  Python 3    → Pyodide WASM via /public/pyodide-worker.js (no server)
 *  C++ / Java  → Judge0 CE free public instance (ce.judge0.com, no key)
 *  Optional    → self-hosted Piston (set VITE_PISTON_API_URL)
 */

const SELF_PISTON_URL = (import.meta.env.VITE_PISTON_API_URL || "").replace(/\/$/, "");
const JUDGE0_URL      = "https://ce.judge0.com";
const JUDGE0_LANG_ID  = { cpp: 54, java: 62 };

export const isJudge0Configured = true;

export const LANGUAGES = [
  { value: "javascript", label: "JavaScript (Node.js)", monaco: "javascript" },
  { value: "python",     label: "Python 3",            monaco: "python"     },
  { value: "cpp",        label: "C++ (GCC)",           monaco: "cpp"        },
  { value: "java",       label: "Java (OpenJDK)",      monaco: "java"       },
];

export const getLanguage = (v) => LANGUAGES.find((l) => l.value === v) || LANGUAGES[0];

/* ──────────────────────────────────────────────────────────────
   Harness stripping
   The DB starter_code contains a Judge0/Piston I/O harness below
   a comment like "// ── Judge0 I/O harness – do not edit ──".
   That harness uses require("fs") / sys.stdin.read() which only
   works in Node.js / CPython — not in browser Workers / Pyodide.
   Strip everything from that comment line downward.
────────────────────────────────────────────────────────────── */
function stripHarness(code) {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim().toLowerCase();
    if (l.includes("judge0") && l.includes("harness")) {
      return lines.slice(0, i).join("\n").trimEnd();
    }
  }
  return code;
}

/* ──────────────────────────────────────────────────────────────
   1. JavaScript — Web Worker (no external API)
   
   Strategy:
   - Strip the harness
   - Find the top-level function name(s) in the user code
   - In the worker, eval() the code inside a try/catch to define
     the function, then call it with the JSON-parsed stdin args
   - Use eval() not new Function() — avoids "Illegal return statement"
     since the code is evaluated at the top level of the worker scope
────────────────────────────────────────────────────────────── */
function runJavaScript(sourceCode, stdin) {
  return new Promise((resolve) => {
    const cleanCode = stripHarness(sourceCode);

    // Parse stdin: Judge0 format is a JSON array of arguments
    // e.g. stdin = "[[7,1,5,3,6,4]]" → args = [[7,1,5,3,6,4]]
    let parsedArgs = null;
    try { parsedArgs = JSON.parse(stdin || "null"); } catch { parsedArgs = null; }
    const argsArray = Array.isArray(parsedArgs) ? parsedArgs : (parsedArgs !== null ? [parsedArgs] : null);

    // Extract top-level function names so the worker knows what to call
    const fnNames = [...cleanCode.matchAll(/^(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\())/gm)]
      .map(m => m[1] || m[2])
      .filter(Boolean);

    const safeCode = JSON.stringify(cleanCode);
    const safeArgs = JSON.stringify(argsArray);
    const safeFns  = JSON.stringify(fnNames);

    // Worker uses eval() at top scope — functions defined at eval top-level
    // are accessible in the same scope, so we can call them by name after.
    const workerSrc = `
const __out   = [];
const __args  = ${safeArgs};
const __fns   = ${safeFns};
const __stdin = ${JSON.stringify(stdin || "")};
const __lines = __stdin.split("\\n");
let   __li    = 0;

// Provide shims that user code might reference
self.readline = () => __lines[__li++] || "";
self.console  = {
  log:   (...a) => __out.push(a.map(v => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" ")),
  error: (...a) => __out.push(a.map(String).join(" ")),
  warn:  (...a) => __out.push(a.map(String).join(" ")),
};
self.process = { stdout: { write: (s) => __out.push(String(s)) } };

try {
  // eval at worker top-level — no "Illegal return statement" issue
  eval(${safeCode});

  // Call the user function with parsed JSON args (mirrors Judge0 harness)
  if (__args !== null && __fns.length > 0) {
    // Try each function name in reverse order (last defined = most likely the answer)
    for (let i = __fns.length - 1; i >= 0; i--) {
      const fn = self[__fns[i]] || eval("typeof " + __fns[i] + " !== 'undefined' ? " + __fns[i] + " : undefined");
      if (typeof fn === "function") {
        const result = fn(...__args);
        if (result !== undefined) __out.push(JSON.stringify(result));
        break;
      }
    }
  }

  postMessage({ ok: true, stdout: __out.join("\\n"), stderr: "" });
} catch(e) {
  postMessage({ ok: false, stdout: __out.join("\\n"), stderr: e.message });
}
`;

    const url    = URL.createObjectURL(new Blob([workerSrc], { type: "application/javascript" }));
    const worker = new Worker(url);
    const timer  = setTimeout(() => {
      worker.terminate(); URL.revokeObjectURL(url);
      resolve({ ok: false, stdout: "", stderr: "Time limit exceeded" });
    }, 10000);

    worker.onmessage = (e) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(e.data); };
    worker.onerror   = (e) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve({ ok: false, stdout: "", stderr: e.message }); };
  });
}

/* ──────────────────────────────────────────────────────────────
   2. Python — Pyodide WASM via static worker file
────────────────────────────────────────────────────────────── */
let _pyWorker    = null;
let _pyReady     = false;
let _pyQueue     = [];
let _pyCallbacks = {};

function ensurePyodideWorker() {
  if (_pyWorker) return;
  _pyWorker = new Worker("/pyodide-worker.js");
  _pyWorker.onmessage = (e) => {
    if (e.data.type === "ready") {
      _pyReady = true;
      _pyQueue.forEach((fn) => fn());
      _pyQueue = [];
    } else if (e.data.type === "result") {
      const cb = _pyCallbacks[e.data.id];
      if (cb) { delete _pyCallbacks[e.data.id]; cb(e.data); }
    }
  };
}

function runPython(sourceCode, stdin) {
  ensurePyodideWorker();
  const cleanCode = stripHarness(sourceCode);
  return new Promise((resolve) => {
    const id    = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      delete _pyCallbacks[id];
      resolve({ stdout: "", stderr: "Time limit exceeded" });
    }, 60000);

    const doRun = () => {
      _pyCallbacks[id] = (data) => {
        clearTimeout(timer);
        resolve({ stdout: data.stdout || "", stderr: data.stderr || "" });
      };
      _pyWorker.postMessage({ id, code: cleanCode, stdin: stdin || "" });
    };

    if (_pyReady) { doRun(); } else { _pyQueue.push(doRun); }
  });
}

/* ──────────────────────────────────────────────────────────────
   3. C++ / Java — Judge0 CE (free, no API key)
────────────────────────────────────────────────────────────── */
async function runViaJudge0(lang, sourceCode, stdin) {
  const langId = JUDGE0_LANG_ID[lang];
  if (!langId) throw new Error(`No Judge0 ID for: ${lang}`);

  const submitRes = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language_id: langId, source_code: sourceCode, stdin: stdin || "" }),
  });
  if (!submitRes.ok) throw new Error(`Judge0 submit HTTP ${submitRes.status}`);
  const { token } = await submitRes.json();
  if (!token) throw new Error("Judge0 returned no token");

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false&fields=status,stdout,stderr,compile_output,time,memory`);
    if (!res.ok) continue;
    const d = await res.json();
    const sid = d.status?.id;
    if (sid <= 2) continue;

    const stdout     = (d.stdout         || "").trim();
    const stderr     = (d.stderr          || "").trim();
    const compileOut = (d.compile_output  || "").trim();

    let statusLabel = "Accepted", statusId = 3;
    if      (sid === 6) { statusLabel = "Compilation Error";   statusId = 6;  }
    else if (sid === 5) { statusLabel = "Time Limit Exceeded"; statusId = 5;  }
    else if (sid >= 7)  { statusLabel = "Runtime Error";       statusId = 11; }

    return { error: false, statusId, statusLabel, stdout, stderr, compileOutput: compileOut, timeSec: d.time ? parseFloat(d.time) : null, memoryKb: d.memory || null };
  }
  throw new Error("Judge0 timed out");
}

/* ──────────────────────────────────────────────────────────────
   4. Self-hosted Piston (optional)
────────────────────────────────────────────────────────────── */
async function runViaSelfPiston(lang, sourceCode, stdin) {
  const FILE = { javascript: "sol.js", python: "sol.py", cpp: "sol.cpp", java: "Main.java" };
  const RT   = { javascript: "javascript", python: "python", cpp: "c++", java: "java" };
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${SELF_PISTON_URL}/execute`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ language: RT[lang], version: "*", files: [{ name: FILE[lang], content: sourceCode }], stdin: stdin || "" }),
    });
    if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);
    const d = await res.json();
    if (d.message) throw new Error(d.message);
    const run = d.run || {}, compile = d.compile || {};
    const compileErr = (compile.stderr || compile.stdout || "").trim();
    const stdout     = (run.stdout || "").trim();
    const stderr     = (run.stderr  || "").trim();
    let statusLabel = "Accepted", statusId = 3;
    if (compileErr && compile.code !== 0) { statusLabel = "Compilation Error"; statusId = 6; }
    else if (run.code !== 0 || run.signal === "SIGKILL") {
      statusLabel = run.signal === "SIGKILL" ? "Time Limit Exceeded" : "Runtime Error";
      statusId    = run.signal === "SIGKILL" ? 5 : 11;
    }
    return { error: false, statusId, statusLabel, stdout, stderr, compileOutput: compileErr, timeSec: null, memoryKb: null };
  } finally { clearTimeout(t); }
}

/* ──────────────────────────────────────────────────────────────
   Public API
────────────────────────────────────────────────────────────── */
export async function runOne({ sourceCode, stdin, language }) {
  const lang = language || "javascript";
  try {
    if (lang === "javascript") {
      const r = await runJavaScript(sourceCode, stdin);
      return {
        error: false,
        statusId:    (!r.ok || r.stderr) ? 11 : 3,
        statusLabel: (!r.ok || r.stderr) ? "Runtime Error" : "Accepted",
        stdout: (r.stdout || "").trim(),
        stderr: (r.stderr || "").trim(),
        compileOutput: "", timeSec: null, memoryKb: null,
      };
    }

    if (lang === "python") {
      const r = await runPython(sourceCode, stdin);
      const hasErr = !!(r.stderr && !r.stdout);
      return {
        error: false,
        statusId:    hasErr ? 11 : 3,
        statusLabel: hasErr ? "Runtime Error" : "Accepted",
        stdout: (r.stdout || "").trim(),
        stderr: (r.stderr || "").trim(),
        compileOutput: "", timeSec: null, memoryKb: null,
      };
    }

    if (SELF_PISTON_URL) {
      try { return await runViaSelfPiston(lang, sourceCode, stdin); }
      catch (e) { console.warn("[executor] Self-hosted Piston failed:", e.message); }
    }
    return await runViaJudge0(lang, sourceCode, stdin);

  } catch (e) {
    return { error: true, message: `Execution failed: ${e.message}` };
  }
}

export async function runAgainstTestCases({ sourceCode, testCases, language }) {
  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const r  = await runOne({ sourceCode, stdin: tc.stdin, language });
    if (r.error) return { error: true, message: r.message };

    const passed = r.statusId === 3 && r.stdout === (tc.expected || "").trim();
    results.push({
      hidden: tc.hidden, passed, statusLabel: r.statusLabel,
      stdin: tc.stdin, expected: tc.expected, actual: r.stdout,
      stderr: r.stderr, compileOutput: r.compileOutput,
      timeSec: r.timeSec, memoryKb: r.memoryKb,
    });

    if (r.statusId === 6) {
      for (let j = i + 1; j < testCases.length; j++) {
        results.push({ hidden: testCases[j].hidden, passed: false, statusLabel: "Compilation Error", stdin: null, expected: null, actual: null, stderr: "", compileOutput: r.compileOutput, timeSec: null, memoryKb: null });
      }
      break;
    }
  }
  return {
    error: false, results,
    passedCount: results.filter((r) => r.passed).length,
    totalCount: testCases.length,
    maxTimeSec:   results.reduce((m, r) => Math.max(m, r.timeSec   || 0), 0) || null,
    maxMemoryKb:  results.reduce((m, r) => Math.max(m, r.memoryKb  || 0), 0) || null,
  };
}
