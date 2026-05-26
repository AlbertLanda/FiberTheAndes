document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // BOTÓN REDIRECCIÓN A HELPDESK AZURE (CON TEXTO)
    // ============================================================
    
    // Inyectamos la burbuja con el icono y el nuevo texto
    const helpdeskHTML = `
        <div id="helpdesk-bubble" class="helpdesk-bubble" style="cursor: pointer;">
            <i class="fas fa-headset"></i>
            <span class="helpdesk-text">Soporte Técnico</span>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', helpdeskHTML);

    const bubble = document.getElementById('helpdesk-bubble');

    // Le decimos que al hacer clic, vaya directo a la URL
    if (bubble) {
        bubble.addEventListener('click', (e) => {
            e.preventDefault(); // Evitamos cualquier otro comportamiento por defecto
            window.location.href = 'https://app-helpdesk-fiberandes-cyawehc4h9gadcbb.centralus-01.azurewebsites.net/login/';
        });
    }

});
