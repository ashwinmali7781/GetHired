const { buildStarterCode } = require("./harness-builder.js");

function sqlStr(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlArr(arr) {
  return "ARRAY[" + arr.map((s) => sqlStr(s)).join(", ") + "]::text[]";
}
function sqlJson(obj) {
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

// ---- Problems with full Judge0 multi-language test-case grading ----
const GRADED = [
  {
    title: "Two Sum", category: "Arrays", difficulty: "Easy",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Reads input as a JSON array: [nums, target]. Return the two indices as an array.",
    solution: "Use a hash map to store complements. For each number, check if target - num exists in the map.",
    companies: ["Google", "Amazon", "Microsoft", "Adobe"],
    functionName: "twoSum",
    params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
    returnType: "int[]",
    jsBody: "const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];",
    pyBody: "seen = {}\n    for i, n in enumerate(nums):\n        need = target - n\n        if need in seen:\n            return [seen[need], i]\n        seen[n] = i\n    return []",
    tests: [
      { input: [[2, 7, 11, 15], 9], output: [0, 1], hidden: false },
      { input: [[3, 2, 4], 6], output: [1, 2], hidden: false },
      { input: [[3, 3], 6], output: [0, 1], hidden: true },
      { input: [[1, 5, 8, 10, 13], 18], output: [2, 3], hidden: true },
    ],
  },
  {
    title: "Valid Parentheses", category: "Strings", difficulty: "Easy",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Reads input as a JSON array: [s]. Return true or false.",
    solution: "Use a stack. Push opening brackets and pop when closing brackets match.",
    companies: ["Meta", "Amazon", "Bloomberg"],
    functionName: "isValid",
    params: [{ name: "s", type: "string" }],
    returnType: "bool",
    jsBody: "const pairs = { ')': '(', ']': '[', '}': '{' };\n  const stack = [];\n  for (const ch of s) {\n    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);\n    else if (stack.pop() !== pairs[ch]) return false;\n  }\n  return stack.length === 0;",
    pyBody: "pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for ch in s:\n        if ch in '([{':\n            stack.append(ch)\n        elif not stack or stack.pop() != pairs[ch]:\n            return False\n    return not stack",
    tests: [
      { input: ["()[]{}"], output: true, hidden: false },
      { input: ["(]"], output: false, hidden: false },
      { input: ["({[]})"], output: true, hidden: true },
      { input: ["((("], output: false, hidden: true },
    ],
  },
  {
    title: "Climbing Stairs", category: "Dynamic Programming", difficulty: "Easy",
    description: "You are climbing a staircase. It takes n steps to reach the top. Each time you can climb 1 or 2 steps. How many distinct ways can you climb to the top? Reads input as a JSON array: [n].",
    solution: "This is essentially Fibonacci. dp[i] = dp[i-1] + dp[i-2].",
    companies: ["Amazon", "Apple", "Adobe"],
    functionName: "climbStairs",
    params: [{ name: "n", type: "int" }],
    returnType: "int",
    jsBody: "let a = 1, b = 1;\n  for (let i = 0; i < n; i++) [a, b] = [b, a + b];\n  return a;",
    pyBody: "a, b = 1, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a",
    tests: [
      { input: [2], output: 2, hidden: false },
      { input: [3], output: 3, hidden: false },
      { input: [5], output: 8, hidden: true },
      { input: [10], output: 89, hidden: true },
    ],
  },
  {
    title: "Longest Increasing Subsequence", category: "Dynamic Programming", difficulty: "Medium",
    description: "Given an integer array nums, return the length of the longest strictly increasing subsequence. Reads input as a JSON array: [nums].",
    solution: "Use DP where dp[i] is the length of LIS ending at index i. For each i, check all j < i.",
    companies: ["Google", "Microsoft", "Netflix"],
    functionName: "lengthOfLIS",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
    jsBody: "const dp = new Array(nums.length).fill(1);\n  let best = nums.length ? 1 : 0;\n  for (let i = 0; i < nums.length; i++) {\n    for (let j = 0; j < i; j++) {\n      if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);\n    }\n    best = Math.max(best, dp[i]);\n  }\n  return best;",
    pyBody: "if not nums:\n        return 0\n    dp = [1] * len(nums)\n    for i in range(len(nums)):\n        for j in range(i):\n            if nums[j] < nums[i]:\n                dp[i] = max(dp[i], dp[j] + 1)\n    return max(dp)",
    tests: [
      { input: [[10, 9, 2, 5, 3, 7, 101, 18]], output: 4, hidden: false },
      { input: [[0, 1, 0, 3, 2, 3]], output: 4, hidden: false },
      { input: [[7, 7, 7, 7]], output: 1, hidden: true },
      { input: [[1, 3, 6, 7, 9, 4, 10, 5, 6]], output: 6, hidden: true },
    ],
  },
  {
    title: "Word Break", category: "Dynamic Programming", difficulty: "Medium",
    description: "Given a string s and a dictionary of strings wordDict, return true if s can be segmented into a space-separated sequence of dictionary words. Reads input as a JSON array: [s, wordDict].",
    solution: "Use DP. dp[i] is true if s[0..i-1] can be segmented. Check all possible breaks.",
    companies: ["Meta", "Google", "Uber"],
    functionName: "wordBreak",
    params: [{ name: "s", type: "string" }, { name: "wordDict", type: "string[]" }],
    returnType: "bool",
    jsBody: "const words = new Set(wordDict);\n  const dp = new Array(s.length + 1).fill(false);\n  dp[0] = true;\n  for (let i = 1; i <= s.length; i++) {\n    for (let j = 0; j < i; j++) {\n      if (dp[j] && words.has(s.slice(j, i))) { dp[i] = true; break; }\n    }\n  }\n  return dp[s.length];",
    pyBody: "words = set(wordDict)\n    dp = [False] * (len(s) + 1)\n    dp[0] = True\n    for i in range(1, len(s) + 1):\n        for j in range(i):\n            if dp[j] and s[j:i] in words:\n                dp[i] = True\n                break\n    return dp[len(s)]",
    tests: [
      { input: ["leetcode", ["leet", "code"]], output: true, hidden: false },
      { input: ["applepenapple", ["apple", "pen"]], output: true, hidden: false },
      { input: ["catsandog", ["cats", "dog", "sand", "and", "cat"]], output: false, hidden: true },
      { input: ["a", ["b"]], output: false, hidden: true },
    ],
  },
  {
    title: "Best Time to Buy and Sell Stock", category: "Arrays", difficulty: "Easy",
    description: "Given an array prices where prices[i] is the price of a stock on day i, return the maximum profit from one buy and one sell. Return 0 if no profit is possible. Reads input as a JSON array: [prices].",
    solution: "Track the minimum price seen so far and the best profit at each step.",
    companies: ["Amazon", "Goldman Sachs", "Bloomberg"],
    functionName: "maxProfit",
    params: [{ name: "prices", type: "int[]" }],
    returnType: "int",
    jsBody: "let minPrice = Infinity, best = 0;\n  for (const p of prices) {\n    minPrice = Math.min(minPrice, p);\n    best = Math.max(best, p - minPrice);\n  }\n  return best;",
    pyBody: "min_price = float('inf')\n    best = 0\n    for p in prices:\n        min_price = min(min_price, p)\n        best = max(best, p - min_price)\n    return best",
    tests: [
      { input: [[7, 1, 5, 3, 6, 4]], output: 5, hidden: false },
      { input: [[7, 6, 4, 3, 1]], output: 0, hidden: false },
      { input: [[2, 4, 1]], output: 2, hidden: true },
      { input: [[1, 2]], output: 1, hidden: true },
    ],
  },
  {
    title: "Contains Duplicate", category: "Hashing", difficulty: "Easy",
    description: "Given an integer array nums, return true if any value appears at least twice in the array. Reads input as a JSON array: [nums].",
    solution: "Use a hash set; if a number is already in the set, return true.",
    companies: ["Apple", "Microsoft", "LinkedIn"],
    functionName: "containsDuplicate",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "bool",
    jsBody: "return new Set(nums).size !== nums.length;",
    pyBody: "return len(set(nums)) != len(nums)",
    tests: [
      { input: [[1, 2, 3, 1]], output: true, hidden: false },
      { input: [[1, 2, 3, 4]], output: false, hidden: false },
      { input: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], output: true, hidden: true },
      { input: [[7]], output: false, hidden: true },
    ],
  },
  {
    title: "Valid Anagram", category: "Strings", difficulty: "Easy",
    description: "Given two strings s and t, return true if t is an anagram of s. Reads input as a JSON array: [s, t].",
    solution: "Count character frequencies in both strings and compare, or sort both and compare.",
    companies: ["Amazon", "Bloomberg", "Uber"],
    functionName: "isAnagram",
    params: [{ name: "s", type: "string" }, { name: "t", type: "string" }],
    returnType: "bool",
    jsBody: "if (s.length !== t.length) return false;\n  return s.split('').sort().join('') === t.split('').sort().join('');",
    pyBody: "return sorted(s) == sorted(t)",
    tests: [
      { input: ["anagram", "nagaram"], output: true, hidden: false },
      { input: ["rat", "car"], output: false, hidden: false },
      { input: ["a", "ab"], output: false, hidden: true },
      { input: ["listen", "silent"], output: true, hidden: true },
    ],
  },
  {
    title: "Maximum Subarray", category: "Arrays", difficulty: "Medium",
    description: "Given an integer array nums, find the contiguous subarray with the largest sum and return its sum (Kadane's algorithm). Reads input as a JSON array: [nums].",
    solution: "Kadane's algorithm: keep a running sum, resetting to the current element whenever the running sum goes negative.",
    companies: ["Microsoft", "Apple", "LinkedIn"],
    functionName: "maxSubArray",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
    jsBody: "let best = nums[0], cur = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    cur = Math.max(nums[i], cur + nums[i]);\n    best = Math.max(best, cur);\n  }\n  return best;",
    pyBody: "best = cur = nums[0]\n    for n in nums[1:]:\n        cur = max(n, cur + n)\n        best = max(best, cur)\n    return best",
    tests: [
      { input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], output: 6, hidden: false },
      { input: [[1]], output: 1, hidden: false },
      { input: [[5, 4, -1, 7, 8]], output: 23, hidden: true },
      { input: [[-1, -2, -3]], output: -1, hidden: true },
    ],
  },
  {
    title: "Coin Change", category: "Dynamic Programming", difficulty: "Medium",
    description: "Given an array of coin denominations and a target amount, return the fewest number of coins needed to make up that amount, or -1 if impossible. Reads input as a JSON array: [coins, amount].",
    solution: "Bottom-up DP: dp[a] = min coins to make amount a, building up from dp[0] = 0.",
    companies: ["Google", "Uber", "Airbnb"],
    functionName: "coinChange",
    params: [{ name: "coins", type: "int[]" }, { name: "amount", type: "int" }],
    returnType: "int",
    jsBody: "const dp = new Array(amount + 1).fill(Infinity);\n  dp[0] = 0;\n  for (let a = 1; a <= amount; a++) {\n    for (const c of coins) {\n      if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);\n    }\n  }\n  return dp[amount] === Infinity ? -1 : dp[amount];",
    pyBody: "dp = [0] + [float('inf')] * amount\n    for a in range(1, amount + 1):\n        for c in coins:\n            if c <= a:\n                dp[a] = min(dp[a], dp[a - c] + 1)\n    return -1 if dp[amount] == float('inf') else dp[amount]",
    tests: [
      { input: [[1, 2, 5], 11], output: 3, hidden: false },
      { input: [[2], 3], output: -1, hidden: false },
      { input: [[1], 0], output: 0, hidden: true },
      { input: [[1, 3, 4], 6], output: 2, hidden: true },
    ],
  },
  {
    title: "Single Number", category: "Bit Manipulation", difficulty: "Easy",
    description: "Given a non-empty array of integers where every element appears twice except for one, find that single one. Reads input as a JSON array: [nums].",
    solution: "XOR all numbers together — duplicates cancel out (a ^ a = 0), leaving the single number.",
    companies: ["Airbnb", "ByteDance", "Adobe"],
    functionName: "singleNumber",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
    jsBody: "return nums.reduce((a, b) => a ^ b, 0);",
    pyBody: "result = 0\n    for n in nums:\n        result ^= n\n    return result",
    tests: [
      { input: [[2, 2, 1]], output: 1, hidden: false },
      { input: [[4, 1, 2, 1, 2]], output: 4, hidden: false },
      { input: [[1]], output: 1, hidden: true },
      { input: [[7, 3, 7]], output: 3, hidden: true },
    ],
  },
  {
    title: "Counting Bits", category: "Bit Manipulation", difficulty: "Easy",
    description: "Given an integer n, return an array of length n+1 where each element i is the number of 1 bits in the binary representation of i. Reads input as a JSON array: [n].",
    solution: "Use the DP relation bits[i] = bits[i >> 1] + (i & 1).",
    companies: ["Google", "ByteDance"],
    functionName: "countBits",
    params: [{ name: "n", type: "int" }],
    returnType: "int[]",
    jsBody: "const res = new Array(n + 1).fill(0);\n  for (let i = 1; i <= n; i++) res[i] = res[i >> 1] + (i & 1);\n  return res;",
    pyBody: "res = [0] * (n + 1)\n    for i in range(1, n + 1):\n        res[i] = res[i >> 1] + (i & 1)\n    return res",
    tests: [
      { input: [2], output: [0, 1, 1], hidden: false },
      { input: [5], output: [0, 1, 1, 2, 1, 2], hidden: false },
      { input: [0], output: [0], hidden: true },
      { input: [8], output: [0, 1, 1, 2, 1, 2, 2, 3, 1], hidden: true },
    ],
  },
  {
    title: "Binary Search", category: "Searching", difficulty: "Easy",
    description: "Given a sorted array of integers nums and an integer target, return the index of target if found, otherwise -1. Reads input as a JSON array: [nums, target].",
    solution: "Classic binary search: repeatedly halve the search range based on comparison with the midpoint.",
    companies: ["Microsoft", "Apple", "Oracle"],
    functionName: "binarySearch",
    params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
    returnType: "int",
    jsBody: "let lo = 0, hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;",
    pyBody: "lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1",
    tests: [
      { input: [[-1, 0, 3, 5, 9, 12], 9], output: 4, hidden: false },
      { input: [[-1, 0, 3, 5, 9, 12], 2], output: -1, hidden: false },
      { input: [[5], 5], output: 0, hidden: true },
      { input: [[1, 3, 5, 7, 9, 11], 1], output: 0, hidden: true },
    ],
  },
  {
    title: "Kth Largest Element in an Array", category: "Heap", difficulty: "Medium",
    description: "Given an integer array nums and an integer k, return the kth largest element in the array (1st largest is the maximum). Reads input as a JSON array: [nums, k].",
    solution: "Sort descending and index k-1, or use a min-heap of size k for an O(n log k) approach.",
    companies: ["Meta", "Amazon", "Netflix"],
    functionName: "findKthLargest",
    params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
    returnType: "int",
    jsBody: "const sorted = [...nums].sort((a, b) => b - a);\n  return sorted[k - 1];",
    pyBody: "return sorted(nums, reverse=True)[k - 1]",
    tests: [
      { input: [[3, 2, 1, 5, 6, 4], 2], output: 5, hidden: false },
      { input: [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], output: 4, hidden: false },
      { input: [[1], 1], output: 1, hidden: true },
      { input: [[7, 6, 5, 4, 3, 2, 1], 1], output: 7, hidden: true },
    ],
  },
  {
    title: "Merge Intervals", category: "Greedy", difficulty: "Medium",
    description: "Given an array of intervals where intervals[i] = [start, end], merge all overlapping intervals and return the merged list, sorted by start. Reads input as a JSON array: [intervals].",
    solution: "Sort intervals by start time, then greedily merge any interval that overlaps with the last merged one.",
    companies: ["Google", "Meta", "Salesforce"],
    functionName: "mergeIntervals",
    params: [{ name: "intervals", type: "int[][]" }],
    returnType: "int[][]",
    jsBody: "const sorted = [...intervals].sort((a, b) => a[0] - b[0]);\n  const merged = [];\n  for (const [s, e] of sorted) {\n    if (merged.length && s <= merged[merged.length - 1][1]) {\n      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);\n    } else {\n      merged.push([s, e]);\n    }\n  }\n  return merged;",
    pyBody: "sorted_iv = sorted(intervals, key=lambda x: x[0])\n    merged = []\n    for s, e in sorted_iv:\n        if merged and s <= merged[-1][1]:\n            merged[-1][1] = max(merged[-1][1], e)\n        else:\n            merged.append([s, e])\n    return merged",
    tests: [
      { input: [[[1, 3], [2, 6], [8, 10], [15, 18]]], output: [[1, 6], [8, 10], [15, 18]], hidden: false },
      { input: [[[1, 4], [4, 5]]], output: [[1, 5]], hidden: false },
      { input: [[[1, 4], [0, 4]]], output: [[0, 4]], hidden: true },
      { input: [[[1, 4], [2, 3]]], output: [[1, 4]], hidden: true },
    ],
  },
];

// ---- Existing problems kept code-only (complex types: trees/graphs/linked lists) ----
const CODE_ONLY = [
  {
    title: "Binary Tree Inorder Traversal", category: "Trees", difficulty: "Easy",
    description: "Given the root of a binary tree, return the inorder traversal of its nodes' values.",
    solution: "Use recursion: traverse left subtree, visit node, traverse right subtree.",
    starter_code: "function inorderTraversal(root) {\n  // Your code here\n}",
    companies: ["Microsoft", "Amazon", "Adobe"],
  },
  {
    title: "Maximum Depth of Binary Tree", category: "Trees", difficulty: "Easy",
    description: "Given the root of a binary tree, return its maximum depth.",
    solution: "Recursively find max depth: 1 + max(depth(left), depth(right)).",
    starter_code: "function maxDepth(root) {\n  // Your code here\n}",
    companies: ["LinkedIn", "Apple"],
  },
  {
    title: "Number of Islands", category: "Graphs", difficulty: "Medium",
    description: "Given an m x n 2D binary grid which represents a map of '1's (land) and '0's (water), return the number of islands.",
    solution: "Use BFS/DFS. For each '1', mark all connected '1's as visited and increment count.",
    starter_code: "function numIslands(grid) {\n  // Your code here\n}",
    companies: ["Amazon", "Google", "Bloomberg"],
  },
  {
    title: "Clone Graph", category: "Graphs", difficulty: "Medium",
    description: "Given a reference of a node in a connected undirected graph, return a deep copy of the graph.",
    solution: "Use BFS/DFS with a hash map to track cloned nodes.",
    starter_code: "function cloneGraph(node) {\n  // Your code here\n}",
    companies: ["Meta", "Microsoft"],
  },
  {
    title: "Merge k Sorted Lists", category: "Linked Lists", difficulty: "Hard",
    description: "You are given an array of k linked-lists, each sorted in ascending order. Merge all lists into one sorted linked-list.",
    solution: "Use a min-heap (priority queue) to efficiently merge lists.",
    starter_code: "function mergeKLists(lists) {\n  // Your code here\n}",
    companies: ["Google", "Amazon", "Uber"],
  },
  {
    title: "Serialize and Deserialize Binary Tree", category: "Trees", difficulty: "Hard",
    description: "Design an algorithm to serialize and deserialize a binary tree.",
    solution: "Use BFS with level-order traversal for serialization. Use a queue for deserialization.",
    starter_code: "function serialize(root) {\n  // Your code here\n}\nfunction deserialize(data) {\n  // Your code here\n}",
    companies: ["Google", "Meta", "Netflix"],
  },
  {
    title: "Course Schedule", category: "Graphs", difficulty: "Medium",
    description: "There are a total of numCourses courses you have to take. Some courses have prerequisites. Determine if you can finish all courses.",
    solution: "Use topological sort with DFS. Detect cycles in the directed graph.",
    starter_code: "function canFinish(numCourses, prerequisites) {\n  // Your code here\n}",
    companies: ["Meta", "Microsoft", "Oracle"],
  },
  {
    title: "Reverse Linked List", category: "Linked Lists", difficulty: "Easy",
    description: "Given the head of a singly linked list, reverse the list and return the reversed list's head.",
    solution: "Iterate through the list, reversing each node's next pointer as you go.",
    starter_code: "function reverseList(head) {\n  // Your code here\n}",
    companies: ["Amazon", "Apple", "Adobe"],
  },
  {
    title: "Implement Min Stack", category: "Stacks & Queues", difficulty: "Medium",
    description: "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.",
    solution: "Keep a second stack that tracks the minimum value at each level of the main stack.",
    starter_code: "class MinStack {\n  constructor() {\n    // Your code here\n  }\n  push(val) {}\n  pop() {}\n  top() {}\n  getMin() {}\n}",
    companies: ["Amazon", "Bloomberg", "Goldman Sachs"],
  },
];

const CATEGORIES = [
  "Arrays", "Strings", "Linked Lists", "Stacks & Queues", "Trees", "Graphs",
  "Dynamic Programming", "Searching", "Greedy", "Bit Manipulation", "Heap", "Hashing", "Math",
];

const COMPANIES = [
  "Google", "Meta", "Amazon", "Microsoft", "Apple", "Netflix",
  "Uber", "Airbnb", "LinkedIn", "Bloomberg", "Adobe", "Oracle",
  "Salesforce", "Goldman Sachs", "ByteDance",
];

let out = [];
out.push("-- Judge0 online judge integration: expanded category list, per-language");
out.push("-- starter code + harnesses, public/hidden test cases, and company tags.");
out.push("-- Generated by /home/claude/gen/seed.js — see that script for the source");
out.push("-- of truth on starter-code generation (do not hand-edit the generated");
out.push("-- starter_code_lang / test_cases JSON below without regenerating).");
out.push("");
out.push("ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_category_check;");
out.push(`ALTER TABLE public.questions ADD CONSTRAINT questions_category_check CHECK (category IN (${CATEGORIES.map(sqlStr).join(", ")}));`);
out.push("");
out.push("ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS companies TEXT[] NOT NULL DEFAULT '{}';");
out.push("ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS starter_code_lang JSONB NOT NULL DEFAULT '{}'::jsonb;");
out.push("ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS test_cases JSONB NOT NULL DEFAULT '[]'::jsonb;");
out.push("ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS function_name TEXT;");
out.push("");
out.push("-- Backfill companies on the original seed rows (kept as code-only problems --");
out.push("-- trees/graphs/linked lists don't translate cleanly to a single stdin/stdout");
out.push("-- harness across 4 languages, so they stay free-form like before).");
for (const p of CODE_ONLY) {
  out.push(
    `UPDATE public.questions SET companies = ${sqlArr(p.companies)} WHERE title = ${sqlStr(p.title)};`
  );
}
out.push("");
out.push("-- Problems with full multi-language Judge0 grading (public + hidden test cases).");
out.push("-- Five of these titles already exist from the original seed migration, so we");
out.push("-- UPDATE them in place (adding test cases / per-language starter code /");
out.push("-- companies / possibly a corrected category) instead of re-inserting.");
const EXISTING_TITLES = new Set(["Two Sum", "Valid Parentheses", "Climbing Stairs", "Longest Increasing Subsequence", "Word Break"]);

for (const p of GRADED) {
  const code = buildStarterCode(p);
  const testCases = p.tests.map((t) => ({
    stdin: JSON.stringify(t.input),
    expected: JSON.stringify(t.output),
    hidden: t.hidden,
  }));
  if (EXISTING_TITLES.has(p.title)) {
    out.push(
      `UPDATE public.questions SET category = ${sqlStr(p.category)}, description = ${sqlStr(p.description)}, ` +
      `starter_code = ${sqlStr(code.javascript)}, starter_code_lang = ${sqlJson(code)}, test_cases = ${sqlJson(testCases)}, ` +
      `companies = ${sqlArr(p.companies)}, function_name = ${sqlStr(p.functionName)} WHERE title = ${sqlStr(p.title)};`
    );
  }
}
out.push("");
out.push("-- New graded problems (not in the original seed).");
out.push(`INSERT INTO public.questions (title, description, difficulty, category, solution, starter_code, starter_code_lang, test_cases, companies, function_name) VALUES`);
const values = GRADED.filter((p) => !EXISTING_TITLES.has(p.title)).map((p) => {
  const code = buildStarterCode(p);
  const testCases = p.tests.map((t) => ({
    stdin: JSON.stringify(t.input),
    expected: JSON.stringify(t.output),
    hidden: t.hidden,
  }));
  return `(${sqlStr(p.title)}, ${sqlStr(p.description)}, ${sqlStr(p.difficulty)}, ${sqlStr(p.category)}, ${sqlStr(p.solution)}, ${sqlStr(code.javascript)}, ${sqlJson(code)}, ${sqlJson(testCases)}, ${sqlArr(p.companies)}, ${sqlStr(p.functionName)})`;
});
out.push(values.join(",\n") + ";");
out.push("");
out.push("-- A few more code-only problems to round out the new categories (Searching,");
out.push("-- Stacks & Queues, Linked Lists) without graded test cases.");
out.push(`INSERT INTO public.questions (title, description, difficulty, category, solution, starter_code, companies) VALUES`);
const codeOnlyValues = CODE_ONLY.filter((p) => ["Reverse Linked List", "Implement Min Stack"].includes(p.title)).map(
  (p) => `(${sqlStr(p.title)}, ${sqlStr(p.description)}, ${sqlStr(p.difficulty)}, ${sqlStr(p.category)}, ${sqlStr(p.solution)}, ${sqlStr(p.starter_code)}, ${sqlArr(p.companies)})`
);
out.push(codeOnlyValues.join(",\n") + ";");

console.log(out.join("\n"));
