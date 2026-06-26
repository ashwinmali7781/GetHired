/* Pyodide Web Worker — served as a static file to avoid string-escaping hell */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js");

let pyodide = null;

async function init() {
  pyodide = await loadPyodide({ stdout: () => {}, stderr: () => {} });
  postMessage({ type: "ready" });
}
init().catch((e) => postMessage({ type: "error", msg: e.message }));

/**
 * Strip the Judge0 / Piston harness lines from Python code.
 * The harness uses sys.stdin.read() which doesn't work in Pyodide the same way.
 * Everything from the "# ── Judge0 I/O harness" comment downward is removed.
 */
function stripHarness(code) {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("#") && l.toLowerCase().includes("judge0") && l.toLowerCase().includes("harness")) {
      return lines.slice(0, i).join("\n").trimEnd();
    }
  }
  return code;
}

onmessage = async (e) => {
  const { id, code, stdin } = e.data;
  try {
    const cleanCode = stripHarness(code);

    // Pass as globals — zero string escaping needed
    pyodide.globals.set("__user_code__", cleanCode);
    pyodide.globals.set("__stdin_str__", stdin || "");

    const result = await pyodide.runPythonAsync(`
import sys, io, builtins, json

# Set up stdin: lines for readline(), and JSON-parsed args for direct calls
_raw   = __stdin_str__ or ""
_lines = _raw.split("\\n") if _raw.strip() else []
_idx   = [0]

def _input(prompt=""):
    if _idx[0] < len(_lines):
        v = _lines[_idx[0]]; _idx[0] += 1; return v
    return ""

builtins.input = _input
sys.stdin = io.StringIO(_raw)

# Capture stdout and stderr
_out = io.StringIO()
_err = io.StringIO()
sys.stdout = _out
sys.stderr = _err

try:
    _globals = {}
    exec(compile(__user_code__, "<solution>", "exec"), _globals)

    # If stdin is a JSON array, find the last function and call it directly
    # (mirrors what the Judge0 harness does: fn(*json.loads(stdin)))
    try:
        _args = json.loads(_raw) if _raw.strip() else None
        if isinstance(_args, list):
            _fns = [v for v in _globals.values() if callable(v) and not v.__name__.startswith("_")]
            if _fns:
                _result = _fns[-1](*_args)
                if _result is not None:
                    _out.write(json.dumps(_result, separators=(",", ":")))
    except Exception:
        pass  # stdin wasn't JSON or function call failed — output already captured above

except SystemExit:
    pass
except Exception as ex:
    _err.write(type(ex).__name__ + ": " + str(ex))
finally:
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__

[_out.getvalue(), _err.getvalue()]
`);

    const stdout = (result.get(0) || "").trim();
    const stderr = (result.get(1) || "").trim();
    result.destroy();
    postMessage({ type: "result", id, stdout, stderr });
  } catch (ex) {
    postMessage({ type: "result", id, stdout: "", stderr: ex.message });
  }
};
