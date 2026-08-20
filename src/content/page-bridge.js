(() => {
  const REQUEST = "LEETSYNC_PRO_GET_EDITOR_CODE";
  const RESPONSE = "LEETSYNC_PRO_EDITOR_CODE";

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
    if (!data || data.source !== "leetsync-pro" || data.type !== REQUEST) return;

    const result = getMonacoCode();
    window.postMessage({
      source: "leetsync-pro",
      type: RESPONSE,
      requestId: data.requestId,
      result
    }, "*");
  });
})();
