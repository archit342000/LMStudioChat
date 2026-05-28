/**
 * Luminous Chat — Scroll & Viewport Manager
 * Extracted from script.js
 */

let _scrollLockY = 0;
let _lastScrollTime = 0;

// Detect iOS/iPadOS and add class to html element for CSS targeting
const _isIOS = typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
);

/**
 * Scroll Lock Utility (Safari/iOS Fix)
 * Prevents the background body from scrolling when a modal or
 * expanded thought process is active.
 */
function setScrollLock(isLocked) {
  if (isLocked) {
    if (!document.body.classList.contains("no-scroll")) {
      _scrollLockY = window.scrollY;
      if (!_isIOS) {
        document.body.style.position = "fixed";
        document.body.style.top = `-${_scrollLockY}px`;
        document.body.style.width = "100%";
      }
      document.body.classList.add("no-scroll");
    }
  } else {
    // Check if any other locking elements are still open
    const anyModalsOpen = document.querySelector(".modal-backdrop.open");
    const anyThoughtsExpanded = document.querySelector(
      ".thought-container.expanded, .thought-box.expanded",
    );
    if (!anyModalsOpen && !anyThoughtsExpanded) {
      if (document.body.classList.contains("no-scroll")) {
        document.body.classList.remove("no-scroll");
        if (!_isIOS) {
          document.body.style.position = "";
          document.body.style.top = "";
          document.body.style.width = "";
          window.scrollTo(0, _scrollLockY);
        }
      }
    }
  }
}

/**
 * Orchestrates container scrolling with smart behavior.
 * Prevents autoscroll if the user has manually scrolled up to read earlier history.
 */
function scrollToBottom(behavior = "auto", forced = false) {
  const messages = document.getElementById("messages");
  if (!messages) return;

  // Throttled scrolling to prevent UI jank
  const now = Date.now();
  if (!forced && now - _lastScrollTime < 100) return;
  _lastScrollTime = now;

  // Smart Scroll: Detection of user scroll position relative to bottom
  const isNearBottom =
    messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 60;

  if (forced || isNearBottom) {
    requestAnimationFrame(() => {
      messages.scrollTo({ top: messages.scrollHeight, behavior: behavior });
    });
  }
}

/**
 * Visual Viewport Sync for Mobile & Tablet Keyboard Stability
 * Positions the input area dynamically above the on-screen virtual keyboard.
 */
function initScrollManager() {
  if (typeof document !== "undefined") {
    if (_isIOS) {
      document.documentElement.classList.add("is-ios");

      // Dynamic non-blocking viewport lock (prevent iOS rubber-banding/hijacking)
      document.addEventListener("touchmove", (e) => {
        const scrollTarget = e.target.closest(
          "#messages, #workspace-view, .modal-body, .cm-scroller, #file-system-preview-container, .file-system-body, .thought-modal-body, .sidebar-content, .thought-container.expanded .thought-body-inner, .clarification-popover"
        );
        if (!scrollTarget) {
          e.preventDefault();
        }
      }, { passive: false });
    }
  }

  if (window.visualViewport) {
    const chatInputArea = document.getElementById("chat-input-area");
    if (!chatInputArea) return;

    const syncViewport = () => {
      // Robust detection of touch screen / mobile / tablet (including iPads)
      const isMobileOrTouch = typeof isMobileOrTouchDevice === "function" ? 
        isMobileOrTouchDevice() : 
        (window.innerWidth <= 1024 || ("ontouchstart" in window) || (navigator.maxTouchPoints > 0));

      if (isMobileOrTouch) {
        // Calculate the offset from the bottom of the layout viewport
        const offset = window.innerHeight - window.visualViewport.height;

        // Only move if keyboard height is significant (> 10px) to avoid jitter
        if (offset > 10) {
          chatInputArea.style.transform = `translateY(-${offset}px)`;
        } else {
          chatInputArea.style.transform = "translateY(0)";
        }
      } else {
        chatInputArea.style.transform = "";
      }
    };

    window.visualViewport.addEventListener("resize", syncViewport);
    window.visualViewport.addEventListener("scroll", syncViewport);

    // Initial alignment check
    syncViewport();
  }
}

/**
 * Stubs for backwards compatibility and testing.
 * Native CSS handles boundaries now.
 */
function bindOverscrollPrevention(el) {
  // Stub - native CSS handling overscroll-behavior is preferred
}

function bindContainerOverscrollPrevention(containerEl, scrollableSelector) {
  // Stub - native CSS handling overscroll-behavior is preferred
}

// Global Exports
window.setScrollLock = setScrollLock;
window.scrollToBottom = scrollToBottom;
window.initScrollManager = initScrollManager;
