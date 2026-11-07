import { $ } from "./dom";

const LABELS: Record<Exclude<UpdateStatus["state"], "none" | "downloading">, string> = {
  available: "Download",
  ready: "Restart to update",
  failed: "Try again",
};

function message(status: Exclude<UpdateStatus, { state: "none" }>): string {
  switch (status.state) {
    case "available":
      return `Version ${status.version} is available`;
    case "downloading":
      return `Downloading ${status.version}: ${status.percent}%`;
    case "ready":
      return `Version ${status.version} is ready`;
    case "failed":
      return `Couldn't download ${status.version}`;
  }
}

function render(status: UpdateStatus): void {
  const notice = $("#updateNotice");
  const action = $<HTMLButtonElement>("#updateAction");

  notice.hidden = status.state === "none";
  if (status.state === "none") return;

  $("#updateText").textContent = message(status);
  action.hidden = status.state === "downloading";
  if (status.state !== "downloading") action.textContent = LABELS[status.state];
}

export async function wireUpdates(): Promise<void> {
  $("#updateAction").addEventListener("click", () => void window.steam.runUpdateAction());
  window.steam.onUpdate(render);
  render(await window.steam.getUpdate());
}
