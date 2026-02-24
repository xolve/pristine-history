import { storage } from "webextension-polyfill"; 
import { validatePattern, MAX_PATTERN_COUNT } from "./regex-validator";

const elements = {
  newPattern: document.getElementById("new-pattern") as HTMLInputElement,
  addBtn: document.getElementById("add-btn")!,
  addError: document.getElementById("add-error") as HTMLParagraphElement,
  patternList: document.getElementById("pattern-list")!,
  emptyMsg: document.getElementById("empty-msg") as HTMLParagraphElement,
  testUrl: document.getElementById("test-url") as HTMLInputElement,
  testBtn: document.getElementById("test-btn")!,
  testResult: document.getElementById("test-result") as HTMLParagraphElement,
};

let patterns: string[] = [];

async function loadPatterns(): Promise<void> {
  const data = await storage.local.get({ patterns: [] });
  patterns = data.patterns as string[];
}

async function savePatterns(): Promise<void> {
  await storage.local.set({ patterns });
}

function renderPatterns(): void {
  elements.patternList.innerHTML = "";
  elements.emptyMsg.hidden = patterns.length > 0;

  for (let i = 0; i < patterns.length; i++) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = patterns[i];

    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.className = "remove-btn";
    btn.addEventListener("click", () => removePattern(i));

    li.appendChild(span);
    li.appendChild(btn);
    elements.patternList.appendChild(li);
  }
}

function showError(msg: string): void {
  elements.addError.textContent = msg;
  elements.addError.hidden = false;
}

function clearError(): void {
  elements.addError.hidden = true;
}

async function addPattern(): Promise<void> {
  clearError();
  const raw = elements.newPattern.value.trim();

  if (!raw) return;

  if (patterns.length >= MAX_PATTERN_COUNT) {
    showError(`Maximum of ${MAX_PATTERN_COUNT} patterns allowed.`);
    return;
  }

  if (patterns.includes(raw)) {
    showError("This pattern already exists.");
    return;
  }

  const result = validatePattern(raw);
  if (!result.valid) {
    showError(result.error!);
    return;
  }

  patterns.push(raw);
  await savePatterns();
  elements.newPattern.value = "";
  renderPatterns();
}

async function removePattern(index: number): Promise<void> {
  patterns.splice(index, 1);
  await savePatterns();
  renderPatterns();
}

function testUrl(): void {
  const url = elements.testUrl.value.trim();
  if (!url) return;

  elements.testResult.hidden = false;

  for (const src of patterns) {
    try {
      if (new RegExp(src).test(url)) {
        elements.testResult.textContent = `✓ Matches pattern: ${src}`;
        elements.testResult.className = "match";
        return;
      }
    } catch {
      // Skip broken patterns.
    }
  }

  elements.testResult.textContent = "✗ Does not match any pattern.";
  elements.testResult.className = "no-match";
}

elements.addBtn.addEventListener("click", addPattern);
elements.newPattern.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addPattern();
});

elements.testBtn.addEventListener("click", testUrl);
elements.testUrl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") testUrl();
});

loadPatterns().then(renderPatterns);
