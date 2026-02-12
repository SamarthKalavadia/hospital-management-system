document.addEventListener("DOMContentLoaded", () => {
  // Config: show button only if input has value
  const SHOW_ON_TYPE = true;

  function initPasswordToggles() {
    document.querySelectorAll('.password-wrapper').forEach(wrapper => {
      const input = wrapper.querySelector('input');
      const btn = wrapper.querySelector('.toggle-password');

      if (!input || !btn) return;

      // Prevent double init
      if (input.dataset.toggleInit) return;
      input.dataset.toggleInit = "true";

      // 1. Initial State Check
      if (SHOW_ON_TYPE) {
        btn.style.display = input.value.length > 0 ? "flex" : "none";
      } else {
        btn.style.display = "flex";
      }

      // 2. Input Event - Show/Hide button
      input.addEventListener('input', function() {
        if (SHOW_ON_TYPE) {
          btn.style.display = this.value.length > 0 ? "flex" : "none";
        }
      });

      // 3. Click Event - Toggle Type & Icon
      btn.addEventListener('click', function(e) {
        e.preventDefault(); // prevent form submit just in case
        
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        // Update Icon
        if (isPassword) {
            // Switched to TEXT (Visible)
            // Use Open Eye Icon
            btn.innerHTML = `
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            `;
            btn.classList.add("active");
            btn.setAttribute("aria-label", "Hide password");
        } else {
            // Switched to PASSWORD (Hidden)
            // Use Closed Eye Icon with slash
            btn.innerHTML = `
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            `;
            btn.classList.remove("active");
            btn.setAttribute("aria-label", "Show password");
        }
        
        // Focus back to input so user can keep typing
        input.focus();
      });
    });
  }

  // Run on load
  initPasswordToggles();

  // Expose for dynamic content
  window.initPasswordToggles = initPasswordToggles;
});
