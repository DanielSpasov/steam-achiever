export function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  return document.querySelector(selector) as T;
}

export function escapeHtml(value: string): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

export function toast(message: string, kind: "" | "error" | "ok" = ""): void {
  const el = document.createElement("div");
  el.className = "toast" + (kind ? ` toast--${kind}` : "");
  el.textContent = message;
  $("#toasts").appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 3400);
}

// Header capsule, then the tall library capsule, then text initials. The URLs
// come from the main process, which resolves the hash-prefixed asset path that
// newer games use.
export function gameThumb(game: GameInfo, className: string): HTMLElement {
  const img = document.createElement("img");
  img.className = className;
  img.loading = "lazy";
  img.alt = "";
  img.src = game.headerUrl;
  img.onerror = () => {
    if (img.src !== game.capsuleUrl && game.capsuleUrl) {
      img.src = game.capsuleUrl;
      return;
    }
    const fallback = document.createElement("div");
    fallback.className = className + "-fallback";
    fallback.textContent = initials(game.name);
    img.replaceWith(fallback);
  };
  return img;
}

export function achievementIcon(a: AchievementState): HTMLElement {
  const src = (a.unlocked ? a.icon : a.iconGray || a.icon) || "";
  if (!src) {
    const box = document.createElement("div");
    box.className = "ach-icon ach-icon--empty";
    return box;
  }
  const img = document.createElement("img");
  img.className = "ach-icon";
  img.loading = "lazy";
  img.alt = "";
  img.src = src;
  img.onerror = () => {
    const box = document.createElement("div");
    box.className = "ach-icon ach-icon--empty";
    img.replaceWith(box);
  };
  return img;
}
