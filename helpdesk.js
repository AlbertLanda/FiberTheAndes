document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // BOTÓN REDIRECCIÓN A HELPDESK AZURE (TEXTO A LA IZQ + AUTO-OCULTADO)
    // ============================================================
    
    // Inyectamos la burbuja arrancando en modo "expanded" (expandido)
    // Fíjate que ahora el <span> está ANTES que el <i>
    const helpdeskHTML = `
        <div id="helpdesk-bubble" class="helpdesk-bubble expanded" style="cursor: pointer;">
            <span class="helpdesk-text">Soporte Técnico</span>
            <i class="fas fa-headset"></i>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', helpdeskHTML);

    const bubble = document.getElementById('helpdesk-bubble');

    if (bubble) {
        // Temporizador: A los 4000 milisegundos (4 segundos), le cambiamos la clase para que se encoja
        setTimeout(() => {
            bubble.classList.remove('expanded');
            bubble.classList.add('collapsed');
        }, 4000);

        // Evento click: Ir a la URL
        bubble.addEventListener('click', (e) => {
            e.preventDefault(); // Previene cualquier otro comportamiento por defecto
            window.location.href = 'https://app-helpdesk-fiberandes-cyawehc4h9gadcbb.centralus-01.azurewebsites.net/login/';
        });
    }

});
