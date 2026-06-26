/**
 * Static curriculum for the 10-week DSA Roadmap shown on the Practice page.
 * Per-user completion state (which milestones are checked) is stored in
 * Supabase (`roadmap_progress`) and joined onto this data client-side.
 *
 * `dbCategory` maps a week to a real `questions.category` value so the
 * "Practice N problems" button can filter the existing problem bank.
 * Weeks without a matching category (e.g. Backtracking) just clear the
 * filters and drop the learner into the full problem list instead.
 */

export const ROADMAP_WEEKS = [
  {
    week: 1,
    title: "Arrays & Hashing",
    dbCategory: "Arrays",
    problemsTotal: 20,
    milestones: [
      { id: "w1-two-sum", label: "Two Sum & variants", difficulty: "Easy" },
      { id: "w1-sliding-window", label: "Sliding window basics", difficulty: "Easy" },
      { id: "w1-prefix-sums", label: "Prefix sums", difficulty: "Medium" },
      { id: "w1-hashmap-freq", label: "HashMap frequency count", difficulty: "Easy" },
      { id: "w1-kadane", label: "Kadane's algorithm", difficulty: "Medium" },
    ],
  },
  {
    week: 2,
    title: "Linked Lists & Stacks",
    dbCategory: null,
    problemsTotal: 22,
    milestones: [
      { id: "w2-reverse-list", label: "Reverse a linked list", difficulty: "Easy" },
      { id: "w2-cycle-detect", label: "Detect cycle (Floyd's)", difficulty: "Easy" },
      { id: "w2-merge-lists", label: "Merge two sorted lists", difficulty: "Easy" },
      { id: "w2-valid-parens", label: "Valid parentheses (stack)", difficulty: "Easy" },
      { id: "w2-min-stack", label: "Min stack design", difficulty: "Medium" },
      { id: "w2-remove-nth", label: "Remove Nth node from end", difficulty: "Medium" },
    ],
  },
  {
    week: 3,
    title: "Trees & Recursion",
    dbCategory: "Trees",
    problemsTotal: 22,
    milestones: [
      { id: "w3-traversals", label: "Tree traversals (in/pre/post-order)", difficulty: "Easy" },
      { id: "w3-max-depth", label: "Maximum depth of binary tree", difficulty: "Easy" },
      { id: "w3-validate-bst", label: "Validate BST", difficulty: "Medium" },
      { id: "w3-lca", label: "Lowest common ancestor", difficulty: "Medium" },
      { id: "w3-level-order", label: "Level order traversal (BFS)", difficulty: "Medium" },
      { id: "w3-serialize", label: "Serialize & deserialize tree", difficulty: "Hard" },
    ],
  },
  {
    week: 4,
    title: "Graphs",
    dbCategory: "Graphs",
    problemsTotal: 24,
    milestones: [
      { id: "w4-representations", label: "Graph representations (adjacency list/matrix)", difficulty: "Easy" },
      { id: "w4-dfs-bfs", label: "DFS & BFS traversal", difficulty: "Easy" },
      { id: "w4-islands", label: "Number of islands", difficulty: "Medium" },
      { id: "w4-clone-graph", label: "Clone graph", difficulty: "Medium" },
      { id: "w4-course-schedule", label: "Course schedule (topological sort)", difficulty: "Medium" },
      { id: "w4-dijkstra", label: "Dijkstra's shortest path", difficulty: "Hard" },
    ],
  },
  {
    week: 5,
    title: "Dynamic Programming",
    dbCategory: "Dynamic Programming",
    problemsTotal: 24,
    milestones: [
      { id: "w5-climbing-stairs", label: "Climbing stairs / Fibonacci DP", difficulty: "Easy" },
      { id: "w5-house-robber", label: "House robber", difficulty: "Easy" },
      { id: "w5-lis", label: "Longest increasing subsequence", difficulty: "Medium" },
      { id: "w5-coin-change", label: "Coin change", difficulty: "Medium" },
      { id: "w5-word-break", label: "Word break", difficulty: "Medium" },
      { id: "w5-edit-distance", label: "Edit distance", difficulty: "Hard" },
    ],
  },
  {
    week: 6,
    title: "Sorting & Binary Search",
    dbCategory: null,
    problemsTotal: 20,
    milestones: [
      { id: "w6-binary-search", label: "Binary search fundamentals", difficulty: "Easy" },
      { id: "w6-rotated-search", label: "Search in rotated sorted array", difficulty: "Medium" },
      { id: "w6-merge-quick-sort", label: "Merge sort / quicksort implementation", difficulty: "Medium" },
      { id: "w6-kth-largest", label: "Kth largest element", difficulty: "Medium" },
      { id: "w6-median-two-arrays", label: "Median of two sorted arrays", difficulty: "Hard" },
    ],
  },
  {
    week: 7,
    title: "Backtracking",
    dbCategory: null,
    problemsTotal: 20,
    milestones: [
      { id: "w7-subsets", label: "Subsets", difficulty: "Medium" },
      { id: "w7-permutations", label: "Permutations", difficulty: "Medium" },
      { id: "w7-combination-sum", label: "Combination sum", difficulty: "Medium" },
      { id: "w7-n-queens", label: "N-Queens", difficulty: "Hard" },
      { id: "w7-word-search", label: "Word search", difficulty: "Medium" },
    ],
  },
  {
    week: 8,
    title: "Greedy Algorithms",
    dbCategory: null,
    problemsTotal: 20,
    milestones: [
      { id: "w8-greedy-fundamentals", label: "Greedy fundamentals & exchange argument", difficulty: "Easy" },
      { id: "w8-jump-game", label: "Jump game", difficulty: "Medium" },
      { id: "w8-gas-station", label: "Gas station", difficulty: "Medium" },
      { id: "w8-merge-intervals", label: "Interval scheduling (merge intervals)", difficulty: "Medium" },
      { id: "w8-task-scheduler", label: "Task scheduler", difficulty: "Medium" },
    ],
  },
  {
    week: 9,
    title: "Bit Manipulation",
    dbCategory: null,
    problemsTotal: 22,
    milestones: [
      { id: "w9-bitwise-ops", label: "Bitwise operators fundamentals", difficulty: "Easy" },
      { id: "w9-single-number", label: "Single number", difficulty: "Easy" },
      { id: "w9-counting-bits", label: "Counting bits", difficulty: "Easy" },
      { id: "w9-power-of-two", label: "Power of two / four", difficulty: "Easy" },
      { id: "w9-sum-no-plus", label: "Sum of two integers (no +/-)", difficulty: "Medium" },
      { id: "w9-bitmask-subsets", label: "Subsets via bitmask", difficulty: "Medium" },
    ],
  },
  {
    week: 10,
    title: "Math & Number Theory",
    dbCategory: null,
    problemsTotal: 26,
    milestones: [
      { id: "w10-gcd-lcm", label: "GCD / LCM", difficulty: "Easy" },
      { id: "w10-sieve", label: "Sieve of Eratosthenes (primes)", difficulty: "Easy" },
      { id: "w10-mod-exp", label: "Modular exponentiation", difficulty: "Medium" },
      { id: "w10-fast-power", label: "Fast power", difficulty: "Medium" },
      { id: "w10-combinatorics", label: "Combinatorics basics (nCr)", difficulty: "Medium" },
      { id: "w10-divisibility", label: "Number theory: divisibility tricks", difficulty: "Medium" },
    ],
  },
];

export const TOTAL_ROADMAP_PROBLEMS = ROADMAP_WEEKS.reduce((sum, w) => sum + w.problemsTotal, 0);
export const TOTAL_MILESTONES = ROADMAP_WEEKS.reduce((sum, w) => sum + w.milestones.length, 0);

// The 6 topics surfaced in "Weak topic analysis" — mirrors the weeks a
// learner most often stalls on (matches the original roadmap mock).
export const WEAK_TOPIC_WEEKS = [1, 3, 4, 5, 7, 9];

/** Fraction (0-1) of a week's milestones that are checked off. */
export function weekCompletionFraction(week, completedMilestoneIds) {
  if (!week.milestones.length) return 0;
  const done = week.milestones.filter((m) => completedMilestoneIds.has(m.id)).length;
  return done / week.milestones.length;
}

/**
 * Status of a week: "completed" (100%), "in_progress" (the first
 * not-yet-completed week — the learner's current focus), or "upcoming"
 * (every week after that one).
 */
export function getWeekStatuses(completedMilestoneIds) {
  let currentAssigned = false;
  return ROADMAP_WEEKS.map((week) => {
    const fraction = weekCompletionFraction(week, completedMilestoneIds);
    let status;
    if (fraction >= 1) {
      status = "completed";
    } else if (!currentAssigned) {
      status = "in_progress";
      currentAssigned = true;
    } else {
      status = "upcoming";
    }
    return { ...week, fraction, status };
  });
}

/** Red (weak) → green (strong) gradient color for a 0-100 mastery score. */
export function masteryColor(pct) {
  const hue = Math.max(0, Math.min(100, pct)) * 1.3; // 0 = red, 100 = green (130°)
  return `hsl(${hue}, 72%, 45%)`;
}
