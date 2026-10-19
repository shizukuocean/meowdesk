(function () {
  window.__meowdeskVsErrors = [];
  window.addEventListener("error", function (event) {
    window.__meowdeskVsErrors.push({
      type: "error",
      message: event.message || "",
      source: event.filename || "",
      line: event.lineno || 0,
      column: event.colno || 0,
      stack: event.error && event.error.stack ? String(event.error.stack) : ""
    });
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    window.__meowdeskVsErrors.push({
      type: "unhandledrejection",
      message: reason && reason.message ? String(reason.message) : String(reason),
      stack: reason && reason.stack ? String(reason.stack) : ""
    });
  });
})();
