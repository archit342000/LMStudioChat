/**
 * Luminous Chat — Image Modal Manager
 * Extracted from script.js
 */

// --- Image Modal Logic ---
window.openImageModal = function(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    if (modal && modalImg) {
        modalImg.src = src;
        modal.classList.remove('hidden');
        // Trigger reflow
        void modal.offsetWidth;
        modal.classList.add('open');
    }
};

window.closeImageModal = function() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); // Matches transition duration
    }
};

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const imgModal = document.getElementById('image-modal');
        if (imgModal && imgModal.classList.contains('open')) {
            window.closeImageModal();
        }
        const mermaidModal = document.getElementById('mermaid-modal');
        if (mermaidModal && mermaidModal.classList.contains('open')) {
            window.closeMermaidModal();
        }
    }
});
