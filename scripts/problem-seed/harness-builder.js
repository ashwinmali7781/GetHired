// Generates per-language Judge0 starter code/harnesses for each problem.

const TYPE_CPP = { int: "int", string: "string", bool: "bool", "int[]": "vector<int>", "string[]": "vector<string>", "int[][]": "vector<vector<int>>" };
const TYPE_JAVA = { int: "int", string: "String", bool: "boolean", "int[]": "int[]", "string[]": "String[]", "int[][]": "int[][]" };
const ACCESSOR = { int: "asInt", string: "asString", bool: "asBool", "int[]": "asIntArray", "string[]": "asStringArray", "int[][]": "asIntMatrix" };
const CPP_DEFAULT_RETURN = { int: "return 0;", string: 'return "";', bool: "return false;", "int[]": "return {};", "string[]": "return {};", "int[][]": "return {};" };
const JAVA_DEFAULT_RETURN = { int: "return 0;", string: 'return "";', bool: "return false;", "int[]": "return new int[0];", "string[]": "return new String[0];", "int[][]": "return new int[0][];" };

const CPP_HARNESS_LIB = `struct JsonValue {
  enum Type { NUM, STR, BOOL, ARR } type;
  double num = 0; string str; bool boolean = false;
  vector<JsonValue> arr;
  int asInt() const { return (int)llround(num); }
  bool asBool() const { return boolean; }
  string asString() const { return str; }
  vector<int> asIntArray() const { vector<int> v; for (auto &e : arr) v.push_back(e.asInt()); return v; }
  vector<string> asStringArray() const { vector<string> v; for (auto &e : arr) v.push_back(e.asString()); return v; }
  vector<vector<int>> asIntMatrix() const { vector<vector<int>> v; for (auto &e : arr) v.push_back(e.asIntArray()); return v; }
};

struct JsonParser {
  const string &s; size_t i = 0;
  JsonParser(const string &src) : s(src) {}
  void skip() { while (i < s.size() && isspace((unsigned char)s[i])) i++; }
  JsonValue parse() { skip(); return parseValue(); }
  JsonValue parseValue() {
    skip();
    if (s[i] == '[') return parseArray();
    if (s[i] == '"') return parseString();
    if (s[i] == 't' || s[i] == 'f') return parseBool();
    return parseNumber();
  }
  JsonValue parseArray() {
    JsonValue v; v.type = JsonValue::ARR; i++; skip();
    if (s[i] == ']') { i++; return v; }
    while (true) {
      v.arr.push_back(parseValue()); skip();
      if (s[i] == ',') { i++; continue; }
      if (s[i] == ']') { i++; break; }
    }
    return v;
  }
  JsonValue parseString() {
    JsonValue v; v.type = JsonValue::STR; i++; string out;
    while (s[i] != '"') { if (s[i] == '\\\\') { i++; out += s[i]; } else out += s[i]; i++; }
    i++; v.str = out; return v;
  }
  JsonValue parseBool() {
    JsonValue v; v.type = JsonValue::BOOL;
    if (s[i] == 't') { v.boolean = true; i += 4; } else { v.boolean = false; i += 5; }
    return v;
  }
  JsonValue parseNumber() {
    JsonValue v; v.type = JsonValue::NUM; size_t start = i;
    while (i < s.size() && (isdigit((unsigned char)s[i]) || s[i] == '-' || s[i] == '+' || s[i] == '.' || s[i] == 'e' || s[i] == 'E')) i++;
    v.num = stod(s.substr(start, i - start)); return v;
  }
};

string toJson(int v) { return to_string(v); }
string toJson(bool v) { return v ? "true" : "false"; }
string toJson(const string &v) { return "\\"" + v + "\\""; }
string toJson(const vector<int> &v) {
  string out = "["; for (size_t k = 0; k < v.size(); k++) { if (k) out += ","; out += to_string(v[k]); } return out + "]";
}
string toJson(const vector<vector<int>> &v) {
  string out = "["; for (size_t k = 0; k < v.size(); k++) { if (k) out += ","; out += toJson(v[k]); } return out + "]";
}`;

const JAVA_HARNESS_LIB = `class JsonValue {
  enum Type { NUM, STR, BOOL, ARR }
  Type type; double num; String str; boolean bool; List<JsonValue> arr;
  int asInt() { return (int) Math.round(num); }
  boolean asBool() { return bool; }
  String asString() { return str; }
  int[] asIntArray() { int[] v = new int[arr.size()]; for (int k = 0; k < arr.size(); k++) v[k] = arr.get(k).asInt(); return v; }
  String[] asStringArray() { String[] v = new String[arr.size()]; for (int k = 0; k < arr.size(); k++) v[k] = arr.get(k).asString(); return v; }
  int[][] asIntMatrix() { int[][] v = new int[arr.size()][]; for (int k = 0; k < arr.size(); k++) v[k] = arr.get(k).asIntArray(); return v; }
}

class JsonParser {
  String s; int i = 0;
  JsonParser(String src) { s = src; }
  void skip() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
  JsonValue parse() { skip(); return parseValue(); }
  JsonValue parseValue() {
    skip(); char c = s.charAt(i);
    if (c == '[') return parseArray();
    if (c == '"') return parseString();
    if (c == 't' || c == 'f') return parseBool();
    return parseNumber();
  }
  JsonValue parseArray() {
    JsonValue v = new JsonValue(); v.type = JsonValue.Type.ARR; v.arr = new ArrayList<>(); i++; skip();
    if (s.charAt(i) == ']') { i++; return v; }
    while (true) {
      v.arr.add(parseValue()); skip();
      if (s.charAt(i) == ',') { i++; continue; }
      if (s.charAt(i) == ']') { i++; break; }
    }
    return v;
  }
  JsonValue parseString() {
    JsonValue v = new JsonValue(); v.type = JsonValue.Type.STR; i++; StringBuilder out = new StringBuilder();
    while (s.charAt(i) != '"') { if (s.charAt(i) == '\\\\') { i++; out.append(s.charAt(i)); } else out.append(s.charAt(i)); i++; }
    i++; v.str = out.toString(); return v;
  }
  JsonValue parseBool() {
    JsonValue v = new JsonValue(); v.type = JsonValue.Type.BOOL;
    if (s.charAt(i) == 't') { v.bool = true; i += 4; } else { v.bool = false; i += 5; }
    return v;
  }
  JsonValue parseNumber() {
    JsonValue v = new JsonValue(); v.type = JsonValue.Type.NUM; int start = i;
    while (i < s.length() && (Character.isDigit(s.charAt(i)) || "-+.eE".indexOf(s.charAt(i)) >= 0)) i++;
    v.num = Double.parseDouble(s.substring(start, i)); return v;
  }
}

class JsonOut {
  static String of(int v) { return String.valueOf(v); }
  static String of(boolean v) { return v ? "true" : "false"; }
  static String of(String v) { return "\\"" + v + "\\""; }
  static String of(int[] v) {
    StringBuilder out = new StringBuilder("[");
    for (int k = 0; k < v.length; k++) { if (k > 0) out.append(","); out.append(v[k]); }
    return out.append("]").toString();
  }
  static String of(int[][] v) {
    StringBuilder out = new StringBuilder("[");
    for (int k = 0; k < v.length; k++) { if (k > 0) out.append(","); out.append(of(v[k])); }
    return out.append("]").toString();
  }
}`;

function buildStarterCode(problem) {
  const { functionName, params, returnType, jsBody, pyBody } = problem;
  const argNames = params.map((p) => p.name).join(", ");

  const javascript =
`function ${functionName}(${argNames}) {
  ${jsBody || "// Your code here"}
}

/* ─── Judge0 I/O harness — do not edit below this line ─── */
const __input = JSON.parse(require("fs").readFileSync(0, "utf8"));
const __result = ${functionName}(...__input);
console.log(JSON.stringify(__result));
`;

  const python =
`def ${functionName}(${argNames}):
    ${pyBody || "# Your code here\n    pass"}

# ─── Judge0 I/O harness — do not edit below this line ───
import sys, json
__input = json.loads(sys.stdin.read())
__result = ${functionName}(*__input)
print(json.dumps(__result, separators=(",", ":")))
`;

  const cppExtract = params.map((p, idx) => `  ${TYPE_CPP[p.type]} ${p.name} = input.arr[${idx}].${ACCESSOR[p.type]}();`).join("\n");
  const cpp =
`#include <bits/stdc++.h>
using namespace std;

${TYPE_CPP[returnType]} ${functionName}(${params.map((p) => `${TYPE_CPP[p.type]} ${p.name}`).join(", ")}) {
  // Your code here
  ${CPP_DEFAULT_RETURN[returnType]}
}

/* ─── Judge0 I/O harness — do not edit below this line ─── */
${CPP_HARNESS_LIB}

int main() {
  string raw((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
  JsonValue input = JsonParser(raw).parse();
${cppExtract}
  cout << toJson(${functionName}(${params.map((p) => p.name).join(", ")})) << endl;
  return 0;
}
`;

  const javaExtract = params.map((p, idx) => `    ${TYPE_JAVA[p.type]} ${p.name} = input.arr.get(${idx}).${ACCESSOR[p.type]}();`).join("\n");
  const java =
`import java.util.*;
import java.io.*;

class Solution {
  static ${TYPE_JAVA[returnType]} ${functionName}(${params.map((p) => `${TYPE_JAVA[p.type]} ${p.name}`).join(", ")}) {
    // Your code here
    ${JAVA_DEFAULT_RETURN[returnType]}
  }
}

/* ─── Judge0 I/O harness — do not edit below this line ─── */
${JAVA_HARNESS_LIB}

public class Main {
  public static void main(String[] args) throws IOException {
    StringBuilder sb = new StringBuilder();
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    String line; while ((line = br.readLine()) != null) sb.append(line);
    JsonValue input = new JsonParser(sb.toString()).parse();
${javaExtract}
    System.out.println(JsonOut.of(Solution.${functionName}(${params.map((p) => p.name).join(", ")})));
  }
}
`;

  return { javascript, python, cpp, java };
}

module.exports = { buildStarterCode };
