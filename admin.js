(() => {
  const $ = (id) => document.getElementById(id);
  const fa = (n) => new Intl.NumberFormat("fa-IR").format(Number(n || 0));
  let pollTimer = null;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: { ...(options.headers || {}) },
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data.error || "request_failed");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showDashboard() {
    $("login-panel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("logout-button").classList.remove("hidden");
  }

  function showLogin() {
    $("dashboard").classList.add("hidden");
    $("login-panel").classList.remove("hidden");
    $("logout-button").classList.add("hidden");
    if (pollTimer) clearInterval(pollTimer);
  }

  function renderMetrics(elementId, rows) {
    const el = $(elementId);
    el.replaceChildren();
    if (!rows?.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "هنوز داده‌ای ثبت نشده است.";
      el.append(empty);
      return;
    }
    const max = Math.max(...rows.map(x => Number(x.count || 0)), 1);
    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "metric-row";
      const top = document.createElement("div");
      top.className = "metric-top";
      const name = document.createElement("span");
      name.textContent = row.name || "نامشخص";
      const count = document.createElement("strong");
      count.textContent = fa(row.count);
      top.append(name, count);
      const track = document.createElement("div");
      track.className = "metric-track";
      const fill = document.createElement("div");
      fill.className = "metric-fill";
      fill.style.width = `${Math.max(3, (Number(row.count || 0) / max) * 100)}%`;
      track.append(fill);
      item.append(top, track);
      el.append(item);
    }
  }

  function renderChart(rows) {
    const el = $("daily-chart");
    el.replaceChildren();
    const days = [];
    const byDay = new Map((rows || []).map(r => [r.day, Number(r.views || 0)]));
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      days.push({ key, value: byDay.get(key) || 0, label: new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(d) });
    }
    const max = Math.max(...days.map(x => x.value), 1);
    for (const day of days) {
      const col = document.createElement("div");
      col.className = "bar-column";
      const value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = fa(day.value);
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${Math.max(4, day.value / max * 150)}px`;
      bar.title = `${day.label}: ${fa(day.value)} بازدید`;
      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = day.label;
      col.append(value, bar, label);
      el.append(col);
    }
  }

  function renderRecent(rows) {
    const tbody = $("recent-rows");
    tbody.replaceChildren();
    if (!rows?.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "هنوز بازدیدی ثبت نشده است.";
      tr.append(td);
      tbody.append(tr);
      return;
    }
    for (const row of rows) {
      const tr = document.createElement("tr");
      const when = new Date(Number(row.created_at) * 1000);
      const location = [row.city, row.region, row.country].filter(Boolean).join("، ") || "نامشخص";
      const cells = [
        new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(when),
        row.path || "/",
        row.device_type || "نامشخص",
        row.browser || "نامشخص",
        row.os || "نامشخص",
        location,
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      tbody.append(tr);
    }
  }

  async function refresh() {
    try {
      const data = await api("/api/admin/summary");
      $("online-count").textContent = fa(data.online);
      $("pageviews-count").textContent = fa(data.pageviews24h);
      $("visitors-count").textContent = fa(data.uniqueVisitors24h);
      renderChart(data.daily);
      renderMetrics("devices-list", data.devices);
      renderMetrics("browsers-list", data.browsers);
      renderMetrics("os-list", data.operatingSystems);
      renderMetrics("countries-list", data.countries);
      renderRecent(data.recent);
      $("updated-label").textContent = "آخرین به‌روزرسانی: " + new Intl.DateTimeFormat("fa-IR", { timeStyle: "medium" }).format(new Date());
    } catch (err) {
      if (err.status === 401) showLogin();
      else $("updated-label").textContent = "اتصال موقتاً برقرار نیست";
    }
  }

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    $("login-error").textContent = "";
    try {
      await api("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: $("admin-password").value }),
      });
      $("admin-password").value = "";
      showDashboard();
      await refresh();
      pollTimer = setInterval(refresh, 5000);
    } catch (err) {
      const messages = {
        invalid_credentials: "رمز عبور درست نیست.",
        too_many_attempts: "تلاش‌های زیادی انجام شده؛ ۱۵ دقیقه بعد دوباره امتحان کن.",
        server_not_configured: "تنظیمات سرور کامل نیست.",
        origin_rejected: "درخواست از مبدأ نامعتبر رد شد.",
      };
      $("login-error").textContent = messages[err.message] || "ورود ناموفق بود. تنظیمات سرور را بررسی کن.";
    } finally {
      button.disabled = false;
    }
  });

  $("logout-button").addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST" }); } catch {}
    showLogin();
  });

  (async () => {
    try {
      await api("/api/admin/me");
      showDashboard();
      await refresh();
      pollTimer = setInterval(refresh, 5000);
    } catch {
      showLogin();
    }
  })();
})();
