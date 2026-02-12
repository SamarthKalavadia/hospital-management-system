document.addEventListener("DOMContentLoaded", () => {
  // Use event delegation or just attach to existing buttons
  // Since buttons are static or rendered with the page, we can attach directly.
  // But to be safe for dynamically added elements (if any), delegation is better,
  // but the requirement says "document.querySelectorAll", so I will stick to what user asked 
  // plus observing for new ones if needed. 
  // User asked for specific JS logic:
  
  function initPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
      // Avoid double binding
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";

      btn.addEventListener('click', function() {
          const input = this.parentElement.querySelector('input');
          if (input.type === "password") {
              input.type = "text";
              // Update icon to "Open Eye" (Visible)
              this.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              `;
              this.classList.add("visible");
          } else {
              input.type = "password";
              // Update icon to "Closed Eye" (Hidden)
              this.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              `;
              this.classList.remove("visible");
          }
      });
    });
  }

  initPasswordToggles();

  // If there are dynamic contents (like in dashboard where profiles might be loaded),
  // we might need to re-run or use MutationObserver.
  // For now, I'll expose it globally just in case
  window.initPasswordToggles = initPasswordToggles;
});
