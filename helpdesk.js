document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // BOTÓN REDIRECCIÓN A HELPDESK AZURE (SECUENCIA AUTOMÁTICA)
    // ============================================================
    
    // 1. Inyectamos la burbuja arrancando en modo "collapsed" (Bolita inicial)
    const helpdeskHTML = `
        <div id="helpdesk-bubble" class="helpdesk-bubble collapsed" style="cursor: pointer;">
            <span class="helpdesk-text">Soporte Técnico</span>
            <i class="fas fa-headset"></i>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', helpdeskHTML);

    const bubble = document.getElementById('helpdesk-bubble');

    if (bubble) {
        // 2. Esperamos 1 segundo (1000ms) para que el usuario vea la bolita, y luego la EXPANDIMOS
        setTimeout(() => {
            bubble.classList.remove('collapsed');
            bubble.classList.add('expanded');
            
            // 3. Una vez expandida, esperamos 4 segundos (4000ms) y la VOLVEMOS A CERRAR (Bolita final)
            setTimeout(() => {
                bubble.classList.remove('expanded');
                bubble.classList.add('collapsed');
            }, 4000);
            
        }, 1000);

        // Evento click: Ir a la URL de Azure
        bubble.addEventListener('click', (e) => {
            e.preventDefault(); // Evitamos cualquier otro comportamiento por defecto
            window.location.href = 'https://app-helpdesk-fiberandes-cyawehc4h9gadcbb.centralus-01.azurewebsites.net/login/';
        });
    }

});
