# Problem bank generator

`harness-builder.js` generates the per-language (JavaScript/Python/C++/Java)
starter code + stdin/stdout harness for a Judge0-graded problem, given just
its function name, parameter types, and return type.

`generate-migration.js` contains the actual problem specs (description,
companies, test cases, reference solution bodies) and prints a ready-to-use
Supabase SQL migration to stdout:

```
node generate-migration.js > ../../supabase/migrations/<timestamp>_my_new_problems.sql
```

To add a new graded problem, add an entry to the `GRADED` array with:
- `functionName`, `params` (name + type), `returnType`
  (supported types: `int`, `bool`, `string`, `int[]`, `string[]`, `int[][]`)
- `jsBody` / `pyBody` — the reference solution body for JS and Python
- `tests` — at least 2 public + 2 hidden `{ input: [...], output, hidden }`
  cases (input is the exact argument list passed to the function)

C++ and Java only get the harness + an empty stub (`// Your code here`) since
those languages don't have a reference solution baked into the migration —
the existing JS/Python bodies are enough to validate the test cases are
correct (run `node generate-migration.js` after editing, or see the repo's
PR history for the validation script used when this was first built).
