(() => {
  const REQUEST = "GITSYNC_GET_EDITOR_CODE";
  const RESPONSE = "GITSYNC_EDITOR_CODE";

  function getMonacoCode() {
    try {
      const models = window.monaco?.editor?.getModels?.() || [];
      if (!models.length) return null;
      const model = models
        .filter(m => m && typeof m.getValue === "function")
        .sort((a, b) => (b.getValue().length || 0) - (a.getValue().length || 0))[0];
      if (!model) return null;
      return {
        code: model.getValue(),
        language: model.getLanguageId?.() || ""
      };
    } catch {
      return null;
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "gitsync" || data.type !== REQUEST) return;

    const result = getMonacoCode();
    window.postMessage({
      source: "gitsync",
      type: RESPONSE,
      requestId: data.requestId,
      result
    }, "*");
  });

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
    if (url.includes("/submit/") && window.location.hostname.includes("leetcode.com")) {
      window.postMessage({ source: "gitsync", type: "GITSYNC_SUBMIT_DETECTED" }, "*");
    }
    return origFetch.apply(this, args);
  };
})();
