/**
 * Pristine History — Popup
 */

import { runtime, storage } from "webextension-polyfill";

const toggle = document.getElementById("toggle") as HTMLInputElement;
const statusLabel = document.getElementById("status-label")!;
const patternCount = document.getElementById("pattern-count")!;
const optionsBtn = document.getElementById("options-btn")!;

async function refresh(): Promise<void> {
  const data = await storage.local.get({ patterns: [], enabled: true });
  toggle.checked = data.enabled as boolean;
  statusLabel.textContent = data.enabled ? "Enabled" : "Disabled";
  const n = (data.patterns as string[]).length;
  patternCount.textContent = `${n} pattern${n === 1 ? "" : "s"} configured`;
}

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  statusLabel.textContent = enabled ? "Enabled" : "Disabled";
  storage.local.set({ enabled });
});

optionsBtn.addEventListener("click", () => {
  runtime.openOptionsPage();
});

refresh();
