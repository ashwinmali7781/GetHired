/**
 * Rule-based ATS resume analyzer.
 *
 * Everything here runs locally in the browser — no API key, no signup, no
 * cost, and the resume text never has to leave the device to get a score.
 * It mirrors the checks real ATS parsers and recruiters use: section
 * structure, contact info, quantified impact, action verbs, keyword match,
 * and length/formatting hygiene.
 */

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","for","to","of","in","on","at","by","with","from",
  "as","is","are","was","were","be","been","being","this","that","these","those","it","its","i","we",
  "you","your","our","their","his","her","they","them","he","she","will","would","can","could","should",
  "have","has","had","do","does","did","not","no","so","such","than","too","very","into","about","over",
  "after","before","between","through","during","up","down","out","off","again","further","once","here",
  "there","all","any","both","each","few","more","most","other","some","only","own","same","just","also",
]);

const SECTION_PATTERNS = {
  summary: /\b(summary|objective|profile|about\s*me)\b/i,
  skills: /\b(skills|technical\s*skills|technologies|core\s*competencies|tech\s*stack)\b/i,
  experience: /\b(experience|work\s*experience|employment(?:\s*history)?|professional\s*experience)\b/i,
  education: /\b(education|academic|qualifications)\b/i,
  projects: /\b(projects?|personal\s*projects?|portfolio)\b/i,
  certifications: /\b(certifications?|certificates?|licenses?)\b/i,
};

const ACTION_VERBS = [
  "achieved","architected","automated","built","championed","collaborated","created","decreased",
  "delivered","deployed","designed","developed","directed","drove","engineered","enhanced",
  "established","executed","expanded","improved","implemented","increased","initiated","integrated",
  "launched","led","managed","mentored","migrated","optimized","orchestrated","overhauled",
  "pioneered","reduced","refactored","resolved","scaled","shipped","spearheaded","streamlined",
  "transformed","upgraded",
];

const CLICHES = [
  "hardworking","hard-working","team player","go-getter","results-driven","detail-oriented",
  "self-starter","think outside the box","synergy","fast learner","people person","dynamic individual",
];

const SWE_KEYWORD_BANK = [
  "JavaScript","TypeScript","Python","Java","React","Node.js","SQL","NoSQL","AWS","Azure","GCP",
  "Docker","Kubernetes","Git","REST API","GraphQL","CI/CD","Agile","Scrum","Microservices",
  "System Design","Data Structures","Algorithms","Unit Testing","MongoDB","PostgreSQL","Redis",
  "HTML","CSS","Next.js","Express","Cloud","Machine Learning","API","Linux","Testing","DevOps",
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const LINK_RE = /\b(linkedin\.com|github\.com)\/\S+/i;
const BULLET_RE = /^[\s]*[•·▪‣◦\-*]\s+/;
const NUMBER_RE = /\b\d+(\.\d+)?%|\$\d|\b\d{2,}\b/;

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z+.#-]{1,}/g) || []).filter((w) => !STOPWORDS.has(w) && w.length > 1);
}

function getLines(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function detectSections(text) {
  const lines = getLines(text);
  const found = {};
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    found[key] = lines.some((line) => line.length < 60 && pattern.test(line)) || pattern.test(text);
  }
  return found;
}

function getBulletLines(text) {
  return getLines(text).filter((l) => BULLET_RE.test(l) || /^[A-Z][a-z]+(ed|d)\b/.test(l));
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Pull the most distinctive keywords out of a job description by frequency,
 * filtering stopwords and very short/common words. No external NLP needed.
 */
function extractJdKeywords(jdText, limit = 25) {
  const tokens = tokenize(jdText);
  const freq = new Map();
  for (const t of tokens) {
    if (t.length < 3) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function analyzeResume(resumeText, jobDescription = "") {
  const text = resumeText || "";
  const lines = getLines(text);
  const wordCount = (text.match(/\b\w+\b/g) || []).length;
  const resumeTokens = new Set(tokenize(text));
  const bulletLines = getBulletLines(text);
  const sections = detectSections(text);

  /* ---- 1. Contact info (10 pts) ---- */
  const hasEmail = EMAIL_RE.test(text);
  const hasPhone = PHONE_RE.test(text);
  const hasLink = LINK_RE.test(text);
  const contactScore = (hasEmail ? 5 : 0) + (hasPhone || hasLink ? 5 : 0);

  /* ---- 2. Section completeness (20 pts) ---- */
  const sectionKeys = ["summary", "skills", "experience", "education", "projects"];
  const sectionsPresent = sectionKeys.filter((k) => sections[k]);
  const sectionScore = (sectionsPresent.length / sectionKeys.length) * 20;

  /* ---- 3. Quantified impact (15 pts) ---- */
  const quantifiedBullets = bulletLines.filter((l) => NUMBER_RE.test(l));
  const quantifiedRatio = bulletLines.length ? quantifiedBullets.length / bulletLines.length : 0;
  const quantScore = clamp(quantifiedRatio * 100, 0, 100) * 0.15;

  /* ---- 4. Action verbs (15 pts) ---- */
  const verbRegex = new RegExp(`\\b(${ACTION_VERBS.join("|")})\\b`, "i");
  const actionBullets = bulletLines.filter((l) => verbRegex.test(l.replace(BULLET_RE, "")));
  const actionRatio = bulletLines.length ? actionBullets.length / bulletLines.length : 0;
  const actionScore = clamp(actionRatio * 100, 0, 100) * 0.15;

  /* ---- 5. Keyword match (25 pts) ---- */
  const usingJd = jobDescription.trim().length > 40;
  const targetKeywords = usingJd ? extractJdKeywords(jobDescription) : SWE_KEYWORD_BANK.map((k) => k.toLowerCase());
  const matchedKeywords = targetKeywords.filter((kw) => resumeTokens.has(kw) || text.toLowerCase().includes(kw));
  const missingKeywords = (usingJd ? extractJdKeywords(jobDescription, 15) : SWE_KEYWORD_BANK)
    .filter((kw) => !resumeTokens.has(kw.toLowerCase()) && !text.toLowerCase().includes(kw.toLowerCase()))
    .slice(0, 12);
  const keywordRatio = targetKeywords.length ? matchedKeywords.length / targetKeywords.length : 0;
  const keywordScore = clamp(keywordRatio * 100, 0, 100) * 0.25;

  /* ---- 6. Length & formatting (10 pts) ---- */
  let lengthScore = 10;
  if (wordCount < 250) lengthScore = 4;
  else if (wordCount < 350) lengthScore = 7;
  else if (wordCount > 1100) lengthScore = 6;
  else if (wordCount > 900) lengthScore = 8;
  const bulletUsageOk = bulletLines.length >= 4;
  if (!bulletUsageOk) lengthScore = Math.min(lengthScore, 5);

  /* ---- 7. Readability / cliché & pronoun avoidance (5 pts) ---- */
  const lowerText = text.toLowerCase();
  const clicheHits = CLICHES.filter((c) => lowerText.includes(c)).length;
  const pronounHits = (text.match(/\b(I|me|my|myself)\b/g) || []).length;
  let readabilityScore = 5;
  readabilityScore -= Math.min(3, clicheHits);
  readabilityScore -= Math.min(2, Math.floor(pronounHits / 3));
  readabilityScore = clamp(readabilityScore, 0, 5);

  const atsScore = clamp(
    contactScore + sectionScore + quantScore + actionScore + keywordScore + lengthScore + readabilityScore
  );

  /* ---- Category breakdown for charts ---- */
  const categoryScores = [
    { name: "Contact Info", score: clamp((contactScore / 10) * 100) },
    { name: "Sections", score: clamp((sectionScore / 20) * 100) },
    { name: "Quantified Impact", score: clamp((quantScore / 15) * 100) },
    { name: "Action Verbs", score: clamp((actionScore / 15) * 100) },
    { name: "Keyword Match", score: clamp((keywordScore / 25) * 100) },
    { name: "Length & Format", score: clamp((lengthScore / 10) * 100) },
    { name: "Readability", score: clamp((readabilityScore / 5) * 100) },
  ];

  /* ---- Weak sections (plain-language explanations) ---- */
  const weakSections = [];
  if (!hasEmail) weakSections.push({ title: "Missing email address", detail: "ATS systems and recruiters look for a clear email at the top of the resume — add one near your name." });
  if (!hasPhone && !hasLink) weakSections.push({ title: "No phone number or profile link", detail: "Add a phone number, plus your LinkedIn or GitHub URL, so recruiters can verify and reach you." });
  if (!sections.summary) weakSections.push({ title: "No summary/objective section", detail: "A 2-3 line summary at the top helps both ATS parsers and recruiters quickly understand your profile." });
  if (!sections.skills) weakSections.push({ title: "No dedicated skills section", detail: "List your technical skills in their own section — ATS keyword scanners weigh this heavily." });
  if (!sections.experience) weakSections.push({ title: "No experience section detected", detail: "Make sure your work/internship history is under a clearly labeled 'Experience' heading." });
  if (!sections.projects) weakSections.push({ title: "No projects section", detail: "For students/early-career candidates, a 'Projects' section is often what gets you past the ATS." });
  if (quantifiedRatio < 0.3) weakSections.push({ title: "Few quantified achievements", detail: "Only a small share of your bullets include numbers. Add metrics like %, $, time saved, or scale (e.g. '10K+ users')." });
  if (actionRatio < 0.4) weakSections.push({ title: "Weak bullet phrasing", detail: "Start more bullets with strong action verbs (e.g. 'Built', 'Led', 'Optimized') instead of passive phrasing." });
  if (!bulletUsageOk) weakSections.push({ title: "Not enough bullet points", detail: "ATS and recruiters scan bullets much faster than paragraphs — break dense text into bullet points." });
  if (clicheHits > 0) weakSections.push({ title: "Generic buzzwords detected", detail: "Phrases like 'hardworking' or 'team player' add little — replace them with specific, evidence-backed claims." });

  /* ---- Resume improvement suggestions ---- */
  const resumeImprovements = [];
  if (wordCount < 350) resumeImprovements.push("Your resume looks short — expand on your experience and projects with more specific detail (aim for 400-700 words for 1 page).");
  if (wordCount > 900) resumeImprovements.push("Your resume is on the longer side — tighten bullets to the most impactful 1-2 lines each and cut anything older or less relevant.");
  if (keywordRatio < 0.5) resumeImprovements.push(usingJd
    ? "Less than half the key terms from the job description appear in your resume — mirror the exact phrasing the JD uses where truthful."
    : "Add more relevant technical keywords (languages, frameworks, tools) so ATS keyword scans rank you higher.");
  if (actionRatio < 0.5) resumeImprovements.push("Rewrite weaker bullets to start with a strong action verb (e.g. 'Designed', 'Reduced', 'Automated').");
  if (quantifiedRatio < 0.4) resumeImprovements.push("Quantify more bullets — turn 'Improved performance' into 'Improved page load time by 35%'.");
  if (pronounHits > 2) resumeImprovements.push("Drop first-person pronouns ('I', 'my') — resume bullets read better in implied first person without them.");
  if (!hasLink) resumeImprovements.push("Add a LinkedIn and/or GitHub link so recruiters and ATS profile-matching tools can find your work.");
  if (resumeImprovements.length === 0) resumeImprovements.push("Solid foundation — focus on tailoring keywords to each specific job description for the biggest score boost.");

  /* ---- Project improvement suggestions ---- */
  const projectImprovements = [];
  if (!sections.projects) {
    projectImprovements.push("Add a 'Projects' section — even 2-3 well-described personal or academic projects can outweigh a thin work history.");
  } else {
    const projectsBlockMatch = text.match(/projects?[\s\S]{0,1500}/i);
    const projectsText = projectsBlockMatch ? projectsBlockMatch[0] : "";
    if (!/github\.com|gitlab\.com|live demo|deployed|http/i.test(projectsText)) {
      projectImprovements.push("Link each project to its GitHub repo or a live demo so reviewers can verify your work.");
    }
    if (!NUMBER_RE.test(projectsText)) {
      projectImprovements.push("Add measurable outcomes to your projects (e.g. users served, latency reduced, accuracy achieved).");
    }
    const techMentioned = SWE_KEYWORD_BANK.filter((k) => projectsText.toLowerCase().includes(k.toLowerCase()));
    if (techMentioned.length < 2) {
      projectImprovements.push("Explicitly name the tech stack for each project (languages, frameworks, databases, cloud services used).");
    }
    projectImprovements.push("Lead each project bullet with what you built and the impact, then the tools — recruiters skim left to right.");
  }

  return {
    atsScore,
    categoryScores,
    weakSections,
    resumeImprovements,
    projectImprovements,
    missingKeywords,
    matchedKeywordCount: matchedKeywords.length,
    totalKeywordCount: targetKeywords.length,
    usingJobDescription: usingJd,
    wordCount,
    bulletCount: bulletLines.length,
    quantifiedBulletCount: quantifiedBullets.length,
    sectionsPresent,
    hasEmail,
    hasPhone,
    hasLink,
  };
}
