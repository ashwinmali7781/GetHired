-- Add examples column for problems that don't have public test cases
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS examples JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Binary Tree Inorder Traversal ──────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "root = [1,null,2,3]", "output": "[1,3,2]", "explanation": "Inorder traversal visits left → root → right."},
    {"input": "root = []", "output": "[]"},
    {"input": "root = [1]", "output": "[1]"}
  ]'::jsonb,
  constraints = ARRAY[
    'The number of nodes in the tree is in the range [0, 100].',
    '-100 <= Node.val <= 100'
  ]
WHERE title = 'Binary Tree Inorder Traversal';

-- ── Maximum Depth of Binary Tree ───────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "root = [3,9,20,null,null,15,7]", "output": "3"},
    {"input": "root = [1,null,2]", "output": "2"}
  ]'::jsonb,
  constraints = ARRAY[
    'The number of nodes in the tree is in the range [0, 10^4].',
    '-100 <= Node.val <= 100'
  ]
WHERE title = 'Maximum Depth of Binary Tree';

-- ── Number of Islands ──────────────────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "grid = [[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]", "output": "1"},
    {"input": "grid = [[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]", "output": "3"}
  ]'::jsonb,
  constraints = ARRAY[
    'm == grid.length',
    'n == grid[i].length',
    '1 <= m, n <= 300',
    'grid[i][j] is ''0'' or ''1''.'
  ]
WHERE title = 'Number of Islands';

-- ── Clone Graph ────────────────────────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "adjList = [[2,4],[1,3],[2,4],[1,3]]", "output": "[[2,4],[1,3],[2,4],[1,3]]", "explanation": "The graph has 4 nodes. Node 1 connects to 2 and 4. Return a deep copy."},
    {"input": "adjList = [[]]", "output": "[[]]", "explanation": "Single node with no neighbors."},
    {"input": "adjList = []", "output": "[]", "explanation": "Empty graph."}
  ]'::jsonb,
  constraints = ARRAY[
    'The number of nodes in the graph is in the range [0, 100].',
    '1 <= Node.val <= 100',
    'Node.val is unique for each node.',
    'There are no repeated edges and no self-loops.',
    'The graph is connected and all nodes can be visited starting from the given node.'
  ]
WHERE title = 'Clone Graph';

-- ── Merge k Sorted Lists ───────────────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "lists = [[1,4,5],[1,3,4],[2,6]]", "output": "[1,1,2,3,4,4,5,6]"},
    {"input": "lists = []", "output": "[]"},
    {"input": "lists = [[]]", "output": "[]"}
  ]'::jsonb,
  constraints = ARRAY[
    'k == lists.length',
    '0 <= k <= 10^4',
    '0 <= lists[i].length <= 500',
    '-10^4 <= lists[i][j] <= 10^4',
    'lists[i] is sorted in ascending order.',
    'The sum of lists[i].length will not exceed 10^4.'
  ]
WHERE title = 'Merge k Sorted Lists';

-- ── Serialize and Deserialize Binary Tree ──────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "root = [1,2,3,null,null,4,5]", "output": "[1,2,3,null,null,4,5]", "explanation": "Serialization is the process of converting a data structure into a sequence of bits. The encoded string is then sent back and deserialized into the original data structure."},
    {"input": "root = []", "output": "[]"}
  ]'::jsonb,
  constraints = ARRAY[
    'The number of nodes in the tree is in the range [0, 10^4].',
    '-1000 <= Node.val <= 1000'
  ]
WHERE title = 'Serialize and Deserialize Binary Tree';

-- ── Word Break ─────────────────────────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "s = \"leetcode\", wordDict = [\"leet\",\"code\"]", "output": "true", "explanation": "Return true because \"leetcode\" can be segmented as \"leet code\"."},
    {"input": "s = \"applepenapple\", wordDict = [\"apple\",\"pen\"]", "output": "true"},
    {"input": "s = \"catsandog\", wordDict = [\"cats\",\"dog\",\"sand\",\"and\",\"cat\"]", "output": "false"}
  ]'::jsonb,
  constraints = ARRAY[
    '1 <= s.length <= 300',
    '1 <= wordDict.length <= 1000',
    '1 <= wordDict[i].length <= 20',
    's and wordDict[i] consist of only lowercase English letters.',
    'All the strings of wordDict are unique.'
  ]
WHERE title = 'Word Break';

-- ── Course Schedule ────────────────────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "numCourses = 2, prerequisites = [[1,0]]", "output": "true", "explanation": "There are 2 courses. To take course 1 you must first take course 0. This is possible."},
    {"input": "numCourses = 2, prerequisites = [[1,0],[0,1]]", "output": "false", "explanation": "Cycle detected — cannot finish all courses."}
  ]'::jsonb,
  constraints = ARRAY[
    '1 <= numCourses <= 2000',
    '0 <= prerequisites.length <= 5000',
    'prerequisites[i].length == 2',
    '0 <= ai, bi < numCourses',
    'All the pairs prerequisites[i] are unique.'
  ]
WHERE title = 'Course Schedule';

-- ── Reverse Linked List ────────────────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "head = [1,2,3,4,5]", "output": "[5,4,3,2,1]"},
    {"input": "head = [1,2]", "output": "[2,1]"},
    {"input": "head = []", "output": "[]"}
  ]'::jsonb,
  constraints = ARRAY[
    'The number of nodes in the list is in the range [0, 5000].',
    '-5000 <= Node.val <= 5000'
  ]
WHERE title = 'Reverse Linked List';

-- ── Implement Min Stack ────────────────────────────────────────
UPDATE public.questions SET
  examples = '[
    {"input": "[\"MinStack\",\"push\",\"push\",\"push\",\"getMin\",\"pop\",\"top\",\"getMin\"] inputs: [[],[-2],[0],[-3],[],[],[],[]]", "output": "[null,null,null,null,-3,null,0,-2]", "explanation": "MinStack supports push, pop, top, and getMin in O(1)."}
  ]'::jsonb,
  constraints = ARRAY[
    '-2^31 <= val <= 2^31 - 1',
    'Methods pop, top, and getMin operations will always be called on non-empty stacks.',
    'At most 3 * 10^4 calls will be made to push, pop, top, and getMin.'
  ]
WHERE title = 'Implement Min Stack';

-- ── Climbing Stairs (if not already set) ──────────────────────
UPDATE public.questions SET
  constraints = ARRAY['1 <= n <= 45']
WHERE title = 'Climbing Stairs' AND (constraints IS NULL OR constraints = '{}');

-- ── Longest Increasing Subsequence ────────────────────────────
UPDATE public.questions SET
  constraints = ARRAY[
    '1 <= nums.length <= 2500',
    '-10^4 <= nums[i] <= 10^4'
  ]
WHERE title = 'Longest Increasing Subsequence' AND (constraints IS NULL OR constraints = '{}');
