// Only a public tab identifier is stored in sessionStorage. Session credentials
// stay in server-issued HttpOnly cookies, with a different cookie for each tab.
const storageKey = "nexdesk.tab-id";
const validId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
let currentTab = "";
let initialization: Promise<string> | undefined;

function remember(id: string) {
  currentTab = id;
  try {
    sessionStorage.setItem(storageKey, id);
  } catch {
    /* A memory-only session still works when storage is unavailable. */
  }
}

async function claimTab(): Promise<string> {
  let stored = "";
  try {
    stored = sessionStorage.getItem(storageKey) || "";
  } catch {
    /* Use a new identifier. */
  }
  let candidate = validId.test(stored) ? stored.toLowerCase() : crypto.randomUUID();
  if (navigator.locks) {
    // Duplicating a tab can copy sessionStorage. An origin-wide lock prevents
    // that copy from taking over the original tab's authenticated session.
    for (;;) {
      const id = candidate;
      const acquired = await new Promise<boolean | null>((resolve) => {
        void navigator.locks
          .request("nexdesk-tab-" + id, { ifAvailable: true }, async (lock) => {
            if (!lock) {
              resolve(false);
              return;
            }
            remember(id);
            resolve(true);
            await new Promise<void>((release) =>
              window.addEventListener("pagehide", () => release(), { once: true }),
            );
          })
          .catch(() => resolve(null));
      });
      if (acquired) return id;
      if (acquired === null) {
        const fallback = crypto.randomUUID();
        remember(fallback);
        return fallback;
      }
      candidate = crypto.randomUUID();
    }
  }
  if (typeof BroadcastChannel !== "undefined") {
    const instance = crypto.randomUUID();
    const channel = new BroadcastChannel("nexdesk-tab-sessions");
    let occupied = false;
    channel.onmessage = (event) => {
      const message = event.data;
      if (message?.type === "occupied" && message.target === instance) occupied = true;
      if (
        message?.type === "claim" &&
        message.tab === (currentTab || candidate) &&
        (currentTab || instance < message.instance)
      ) {
        channel.postMessage({ type: "occupied", target: message.instance });
      }
    };
    channel.postMessage({ type: "claim", tab: candidate, instance });
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (occupied) candidate = crypto.randomUUID();
    window.addEventListener("pagehide", () => channel.close(), { once: true });
  }
  remember(candidate);
  return candidate;
}

export function ensureTabSession(): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve("");
  initialization ??= claimTab();
  return initialization;
}

export function authenticatedUrl(path: string): string {
  const url = "/api" + path;
  return currentTab
    ? url + (path.includes("?") ? "&" : "?") + "tab=" + encodeURIComponent(currentTab)
    : url;
}

if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
}
