-- Add constraints column for LeetCode-style constraint display
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS constraints TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS constraints_text TEXT;

-- Populate constraints for common problems
UPDATE public.questions SET constraints = ARRAY[
  '2 <= nums.length <= 10^4',
  '-10^9 <= nums[i] <= 10^9',
  '-10^9 <= target <= 10^9',
  'Only one valid answer exists.'
] WHERE title = 'Two Sum';

UPDATE public.questions SET constraints = ARRAY[
  '1 <= s.length <= 10^4',
  's consists of parentheses only ()[]{}.'
] WHERE title = 'Valid Parentheses';

UPDATE public.questions SET constraints = ARRAY[
  '1 <= prices.length <= 10^5',
  '0 <= prices[i] <= 10^4'
] WHERE title = 'Best Time to Buy and Sell Stock';

UPDATE public.questions SET constraints = ARRAY[
  '1 <= nums.length <= 3 * 10^4',
  '-10^5 <= nums[i] <= 10^5'
] WHERE title = 'Maximum Subarray';

UPDATE public.questions SET constraints = ARRAY[
  '1 <= strs.length <= 10^4',
  '0 <= strs[i].length <= 100',
  'strs[i] consists of lowercase English letters only.'
] WHERE title = 'Group Anagrams';

UPDATE public.questions SET constraints = ARRAY[
  '1 <= text.length <= 10^4',
  'text consists of lower case English letters only.'
] WHERE title = 'Max Number of Balloons';
