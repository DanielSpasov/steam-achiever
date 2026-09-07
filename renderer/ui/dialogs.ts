import { $, toast } from "./dom";

type Reload = () => Promise<void> | void;

export function wireDialogs(reloadGames: Reload): void {
  const settings = $("#settingsDialog") as HTMLDialogElement;
  const risk = $("#riskDialog") as HTMLDialogElement;

  $("#settingsBtn").addEventListener("click", async () => {
    const current = await window.steam.getSettings();
    $<HTMLInputElement>("#apiKeyInput").value = current.webApiKey || "";
    $<HTMLInputElement>("#autoCloseInput").checked = current.autoCloseOnVacGame;
    settings.showModal();
  });

  $("#settingsCancel").addEventListener("click", (e) => {
    e.preventDefault();
    settings.close();
  });

  $("#settingsSave").addEventListener("click", async (e) => {
    e.preventDefault();
    await window.steam.setSettings({
      webApiKey: $<HTMLInputElement>("#apiKeyInput").value.trim(),
      autoCloseOnVacGame: $<HTMLInputElement>("#autoCloseInput").checked,
    });
    settings.close();
    toast("Settings saved, rescanning library");
    await reloadGames();
  });

  $("#riskAccept").addEventListener("click", () => {
    void window.steam.setSettings({ riskAccepted: true });
    risk.close();
  });
  $("#riskQuit").addEventListener("click", () => window.close());
  risk.addEventListener("cancel", (e) => e.preventDefault());
}

export function showRiskGate(): void {
  ($("#riskDialog") as HTMLDialogElement).showModal();
}
