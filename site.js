(() => {
  const KEY_VISITOR = "mangool_visitor_id";
  const KEY_SESSION = "mangool_session_id";
  const makeId = () => crypto.randomUUID();

  function getOrCreate(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = makeId();
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return makeId();
    }
  }

  async function track() {
    const visitorId = getOrCreate(localStorage, KEY_VISITOR);
    const sessionId = getOrCreate(sessionStorage, KEY_SESSION);
    try {
      await fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ visitorId, sessionId, path: location.pathname }),
        keepalive: true,
      });
    } catch {
      // Analytics failure must not break the coupon page.
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    track();
    const button = document.getElementById("copy-code");
    const status = document.getElementById("copy-status");
    button?.addEventListener("click", async () => {
      const code = document.getElementById("coupon-code")?.textContent?.trim() || "۱۲۰۰۲۹۳۳";
      try {
        await navigator.clipboard.writeText(code);
        status.textContent = "کد تخفیف کپی شد.";
      } catch {
        status.textContent = "کد را به‌صورت دستی انتخاب و کپی کنید.";
      }
    });
  });
})();
