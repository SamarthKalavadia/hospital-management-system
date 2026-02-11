/**
 * GLOBAL INPUT VALIDATION & SANITY CHECK LAYER
 * Enforces rules for numbers, mobile, email, medicine dose, and required fields.
 */

(function() {
  const Validation = {
    config: {
      errorColor: '#c62828',
      helperColor: '#155c3b',
      mobileRegex: /^\d{10}$/,
      emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      // Medicine dose pattern: X-X-X or "X ml/tab twice daily"
      doseRegex: /^(\d-\d-\d|\d+(\.\d+)?\s*(tab|tabs|ml|unit|units)?\s*(once|twice|thrice|four times)?\s*(daily|a day|weekly)?)$/i,
      doseHelper: "Use format like 1-0-1 or 5 ml twice daily"
    },

    init() {
      console.log("Validation Layer Initialized");
      this.injectStyles();
      this.attachToForms();
      this.attachToInputs();

      // Watch for dynamic DOM changes (modals, new rows)
      const observer = new MutationObserver(() => {
        this.attachToForms();
        this.attachToInputs();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    },

    injectStyles() {
      if (document.getElementById('validation-styles')) return;
      const style = document.createElement('style');
      style.id = 'validation-styles';
      style.textContent = `
        .validation-error-msg {
          color: ${this.config.errorColor} !important;
          font-size: 11px !important;
          margin-top: 4px !important;
          font-weight: 500 !important;
          display: block !important;
        }
        .validation-helper-msg {
          color: ${this.config.helperColor} !important;
          font-size: 11px !important;
          margin-top: 4px !important;
          font-weight: 500 !important;
          display: block !important;
          opacity: 0.8;
        }
        .input-error {
          border-color: ${this.config.errorColor} !important;
          box-shadow: 0 0 0 1px ${this.config.errorColor}44 !important;
        }
        .form-error-summary {
          color: ${this.config.errorColor};
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 15px;
          padding: 10px;
          background: #ffebee;
          border-radius: 8px;
          text-align: center;
        }
      `;
      document.head.appendChild(style);
    },

    attachToForms() {
      document.querySelectorAll('form').forEach(form => {
        if (form.dataset.validationAttached) return;
        form.dataset.validationAttached = "true";

        // Monitor form validity to disable/enable submit button
        form.addEventListener('input', () => this.checkFormValidity(form));
        form.addEventListener('change', () => this.checkFormValidity(form));

        // Prevent submission if invalid
        form.addEventListener('submit', (e) => {
          if (!this.validateForm(form)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);

        this.checkFormValidity(form);
      });
    },

    attachToInputs() {
      // 1. Numeric & Quantity Validation
      const numInputs = document.querySelectorAll('input[type="number"], .med-duration, .med-qty, #cpAge, #updateNewQty, #updateCurrentQty');
      numInputs.forEach(input => {
        if (input.dataset.vNum) return;
        input.dataset.vNum = "true";

        // Prevent typing "-" or "e"
        input.addEventListener('keydown', (e) => {
          if (e.key === '-' || e.key === 'e' || e.key === '+') {
            e.preventDefault();
          }
        });

        input.addEventListener('input', () => {
          const min = parseFloat(input.getAttribute('min')) || 0;
          const max = parseFloat(input.getAttribute('max')) || 120;
          let val = parseFloat(input.value);

          if (val < 0) {
            input.value = 0;
            window.showToast('warning', "Quantity cannot be negative");
          }

          if (isNaN(val)) return;
          if (input.id === 'cpAge' && val > max) input.value = max;
        });
      });

      // 2. Mobile Number Validation
      const phoneInputs = document.querySelectorAll('input[type="tel"], #cpPhone, #contact, [id*="Phone"], [id*="contact"]');
      phoneInputs.forEach(input => {
        if (input.dataset.vPhone) return;
        input.dataset.vPhone = "true";

        input.addEventListener('input', () => {
          // Only digits
          const original = input.value;
          input.value = input.value.replace(/\D/g, '').substring(0, 10);

          if (original.length > 10) {
            window.showToast('info', "Mobile number cannot exceed 10 digits");
          }

          const isValid = this.config.mobileRegex.test(input.value);
          this.toggleError(input, isValid, "Enter a valid 10-digit mobile number");
        });

        input.addEventListener('blur', () => {
          if (input.value !== "" && !this.config.mobileRegex.test(input.value)) {
            window.showToast('error', "Enter a valid 10-digit mobile number");
          }
        });
      });

      // 3. Email Validation
      const emailInputs = document.querySelectorAll('input[type="email"], #cpEmail, #email, [id*="Email"]');
      emailInputs.forEach(input => {
        if (input.dataset.vEmail) return;
        input.dataset.vEmail = "true";

        input.addEventListener('input', () => {
          input.value = input.value.trim();
          const isValid = input.value === "" ? true : this.config.emailRegex.test(input.value);
          this.toggleError(input, isValid, "Enter a valid email address");
        });

        input.addEventListener('blur', () => {
          if (input.value !== "" && !this.config.emailRegex.test(input.value)) {
            window.showToast('error', "Invalid email format");
          }
        });
      });

      // 3b. Name Validation (No Numbers)
      const nameInputs = document.querySelectorAll('#cpName, [id*="Name"], [name*="name"]');
      nameInputs.forEach(input => {
          if (input.dataset.vName) return;
          input.dataset.vName = "true";

          const nameRegex = /^([^0-9]*)$/; // No digits allowed

          input.addEventListener('input', () => {
              const isValid = input.value === "" ? true : nameRegex.test(input.value);
              this.toggleError(input, isValid, "Name cannot contain numbers");
          });

          input.addEventListener('blur', () => {
              if (input.value !== "" && !nameRegex.test(input.value)) {
                  window.showToast('error', "Invalid name format");
              }
          });
      });

      // 4. Medicine Dose Format
      const doseInputs = document.querySelectorAll('.med-dose, [id*="dose"]');
      doseInputs.forEach(input => {
        if (input.dataset.vDose) return;
        input.dataset.vDose = "true";

        input.addEventListener('input', () => {
          const isValid = input.value === "" ? true : this.config.doseRegex.test(input.value.trim());
          this.toggleError(input, isValid, this.config.doseHelper);
        });

        input.addEventListener('blur', () => {
          if (input.value !== "" && !this.config.doseRegex.test(input.value.trim())) {
            window.showToast('warning', "Invalid medicine dose format. Use e.g. 1-0-1");
          }
        });
      });

      // 5. Date Validation (Appointment)
      const dateInputs = document.querySelectorAll('input[type="date"], #bookDate');
      dateInputs.forEach(input => {
        if (input.dataset.vDate) return;
        input.dataset.vDate = "true";

        // Set min to today
        const today = new Date().toISOString().split('T')[0];
        input.setAttribute('min', today);

        input.addEventListener('change', () => {
          if (input.value < today) {
            input.value = today;
          }
        });
      });
    },

    toggleError(input, isValid, message) {
      let errorEl = input.parentNode.querySelector('.validation-error-msg');
      if (!isValid) {
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'validation-error-msg';
          input.parentNode.appendChild(errorEl);
        }
        errorEl.innerText = message;
        input.classList.add('input-error');
      } else {
        if (errorEl) errorEl.remove();
        input.classList.remove('input-error');
      }
      this.checkFormValidity(input.form);
    },

    checkFormValidity(form) {
      if (!form) return;
      const submitBtn = form.querySelector('button[type="submit"], button[onclick*="save"], button[onclick*="handle"], button[onclick*="book"]');
      if (!submitBtn) return;

      const isNativeValid = form.checkValidity();
      const hasCustomErrors = form.querySelectorAll('.input-error').length > 0;

      // Check required fields separately
      let allRequiredFilled = true;
      form.querySelectorAll('[required]').forEach(req => {
        if (!req.value || req.value.trim() === "") {
          allRequiredFilled = false;
        }
      });

      // Rule 5 Special: At least one medicine in prescription
      let specialValid = true;
      if (form.id === 'prescriptionForm') {
        const meds = form.querySelectorAll('.med-row .med-name');
        const hasOneMed = Array.from(meds).some(m => m.value !== "");
        if (!hasOneMed) specialValid = false;
      }

      const isValid = isNativeValid && !hasCustomErrors && allRequiredFilled && specialValid;

      // Rule: For prescription form, we keep the button enabled but visual cues remain,
      // allowing the doctor to click and see the validation toast if needed.
      if (form.id === 'prescriptionForm') {
        submitBtn.disabled = false;
        submitBtn.style.opacity = isValid ? '1' : '0.8';
        submitBtn.style.cursor = 'pointer';
      } else {
        submitBtn.disabled = !isValid;
        submitBtn.style.opacity = isValid ? '1' : '0.5';
        submitBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
      }

      // Show/Hide general "fill all" message if attempt made
      let summary = form.querySelector('.form-error-summary');
      if (!isValid && form.dataset.attempted === "true") {
        if (!summary) {
          summary = document.createElement('div');
          summary.className = 'form-error-summary';
          summary.innerText = "Please fill all required fields correctly" +
            (form.id === 'prescriptionForm' && !specialValid ? " (add at least one medicine)" : "");
          form.prepend(summary);
          window.showToast('error', summary.innerText);
        }
      } else if (summary) {
        summary.remove();
      }
    },

    validateForm(form) {
      form.dataset.attempted = "true";
      let firstInvalid = null;
      let isValid = true;

      form.querySelectorAll('[required]').forEach(input => {
        if (!input.value || input.value.trim() === "") {
          input.classList.add('input-error');
          if (!firstInvalid) firstInvalid = input;
          isValid = false;
        }
      });

      if (form.querySelectorAll('.input-error').length > 0) {
        isValid = false;
        if (!firstInvalid) firstInvalid = form.querySelector('.input-error');
      }

      if (!isValid) {
        this.checkFormValidity(form);
        if (firstInvalid) {
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
      return true;
    },

    // Rule 6: Reschedule/cancel logic
    checkRescheduleAllowed(appointmentDate, appointmentTime) {
      const now = new Date();
      const apptDate = new Date(appointmentDate);

      // Handle time if provided
      if (appointmentTime) {
        const parts = appointmentTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (parts) {
          let h = parseInt(parts[1]);
          const m = parseInt(parts[2]);
          const ampm = (parts[3] || '').toUpperCase();
          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          apptDate.setHours(h, m, 0);
        }
      }

      const diffMs = apptDate - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 24) {
        window.showToast('warning', "You cannot reschedule/cancel within 24 hours of appointment");
        return false;
      }
      return true;
    }
  };

  // Global access for Rule 6
  window.AppValidation = Validation;

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Validation.init());
  } else {
    Validation.init();
  }
})();
