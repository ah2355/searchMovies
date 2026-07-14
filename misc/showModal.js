function showModal(title, text, confirmLabel, onConfirm) {
    var existing = document.getElementById('globalModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'globalModal';

    overlay.innerHTML =
        '<div class="modal-box">' +
            '<div class="modal-icon"><i class="fa-solid fa-circle-info"></i></div>' +
            '<p class="modal-title">' + title + '</p>' +
            '<p class="modal-text">' + text + '</p>' +
            '<div class="modal-actions">' +
                '<button class="modal-btn modal-btn-cancel" id="modalCancelBtn">Maybe Later</button>' +
                '<button class="modal-btn modal-btn-confirm" id="modalConfirmBtn">' + confirmLabel + '</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    document.getElementById('modalCancelBtn').addEventListener('click', function() {
        overlay.remove();
    });
    document.getElementById('modalConfirmBtn').addEventListener('click', function() {
        onConfirm();
    });
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
}

function showLoginModal() {
    showModal('Log In Required', 'You need to be logged in to use this feature.', 'Log In', function() {
        window.location.href = '/users/login';
    });
}
