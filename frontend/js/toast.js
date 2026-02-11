/**
 * ENHANCED GLOBAL TOAST NOTIFICATION SYSTEM
 * Subsystem for smooth feedback, reversibility (UNDO), audio cues, and click-to-dismiss.
 */

(function() {
  const ToastSystem = {
    container: null,
    enableToastSound: true,
    sounds: {
      success: 'data:audio/wav;base64,UklGRmYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YURQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==', // Placeholder
      error: 'data:audio/wav;base64,UklGRmYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YURQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
      warning: 'data:audio/wav;base64,UklGRmYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YURQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
    },

    init() {
      this.injectStyles();
      this.createContainer();
      // Preload sounds (using real-sounding synth data URI or small wave files)
      this.loadAssets();
    },

    loadAssets() {
      // High-quality (short) confirmation beep (Success)
      this.sounds.success = "data:audio/mpeg;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAZGFzaABUWFhYAAAAEgAAA21pbm9fcnZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzbzZtcDQxAFRTU0UAAAAPAAADTGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/+000AAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG";
      // Gentle alert (Error/Warning)
      this.sounds.error = "data:audio/mpeg;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAZGFzaABUWFhYAAAAEgAAA21pbm9yX3ZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzbzZtcDQxAFRTU0UAAAAPAAADTGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/+000AAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG//7T0QAAAAAn8AAAAABEFG";
      this.sounds.warning = this.sounds.error;
    },

    injectStyles() {
      if (document.getElementById('toast-styles')) return;
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        #toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 12px;
          pointer-events: none;
        }
        .toast {
          min-width: 300px;
          max-width: 400px;
          padding: 16px 20px;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          gap: 14px;
          color: #2c3e50;
          font-family: "Inter", "Segoe UI", sans-serif;
          font-size: 14px;
          font-weight: 500;
          pointer-events: auto;
          cursor: pointer;
          animation: toastSlideIn 0.4s cubic-bezier(0.17, 0.88, 0.32, 1.28);
          border-left: 6px solid #ccc;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .toast:hover { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0,0,0,0.18); }
        .toast:active { transform: scale(0.98); }
        
        .toast-success { border-left-color: #155c3b; background: #f8fbf9; }
        .toast-error { border-left-color: #c62828; background: #fff8f8; }
        .toast-warning { border-left-color: #f9a825; background: #fffdf5; }
        .toast-info { border-left-color: #1976d2; background: #f5faff; }
        
        .toast-icon { font-size: 20px; flex-shrink: 0; }
        .toast-content { flex: 1; margin-right: 8px; }
        
        .toast-undo {
          background: transparent;
          border: 1px solid currentColor;
          color: inherit;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          transition: 0.2s;
          margin-left: auto;
          opacity: 0.8;
        }
        .toast-undo:hover { opacity: 1; background: rgba(0,0,0,0.05); }

        .toast.fade-out {
          opacity: 0 !important;
          transform: translateX(40px) scale(0.9) !important;
        }

        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(60px) scale(0.85); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }

        /* Progress bar for auto-dismiss */
        .toast::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: rgba(0,0,0,0.05);
          animation: toastProgress var(--duration, 3s) linear forwards;
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `;
      document.head.appendChild(style);
    },

    createContainer() {
      if (document.getElementById('toast-container')) {
        this.container = document.getElementById('toast-container');
        return;
      }
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    },

    playSound(type) {
      if (!window.enableToastSound || !this.sounds[type]) return;
      try {
        // Short, unobtrusive notification sound
        const audio = new Audio(this.sounds[type]);
        audio.volume = 0.15; // Soft volume
        audio.play().catch(() => {}); // Catch-all for browser interaction rules
      } catch (e) {}
    },

    show(type, message, options = {}) {
      if (!this.container) this.createContainer();

      const duration = options.onUndo ? 5000 : 3000;
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.style.setProperty('--duration', `${duration}ms`);
      
      const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
      
      let html = `
        <span class="toast-icon">${icons[type] || '🔔'}</span>
        <div class="toast-content">${message}</div>
      `;

      if (options.onUndo) {
        html += `<button class="toast-undo">Undo</button>`;
      }

      toast.innerHTML = html;
      this.container.appendChild(toast);
      this.playSound(type);

      // Click to dismiss
      toast.addEventListener('click', (e) => {
        if (e.target.classList.contains('toast-undo')) {
          options.onUndo();
          this.dismiss(toast);
        } else {
          this.dismiss(toast);
        }
      });

      // Auto-dismiss
      const timer = setTimeout(() => this.dismiss(toast), duration);
      toast.dataset.timerId = timer;
    },

    dismiss(toast) {
      if (toast.classList.contains('fade-out')) return;
      toast.classList.add('fade-out');
      clearTimeout(toast.dataset.timerId);
      setTimeout(() => toast.remove(), 400);
    }
  };

  // Global helpers
  window.enableToastSound = true;
  window.showToast = (type, message, options) => ToastSystem.show(type, message, options);

  window.handleError = (error, context = "Request") => {
    console.group(`🔴 Error [${context}]`);
    console.error(error);
    console.groupEnd();

    let userMsg = "Something went wrong. Please try again.";
    
    if (error.status === 401) {
      userMsg = "Session expired. Please login again.";
      setTimeout(() => window.location.href = 'login.html', 2000);
    } else if (error.status === 403) {
      userMsg = "Unauthorized access attempt.";
    } else if (error.status === 409) {
      userMsg = "Schedule conflict detected.";
    } else if (error.status === 404) {
      userMsg = "Item not found.";
    } else if (!navigator.onLine) {
      userMsg = "Unable to connect to server. Check your internet.";
    }
    
    window.showToast('error', userMsg);
  };

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ToastSystem.init());
  } else {
    ToastSystem.init();
  }
})();
