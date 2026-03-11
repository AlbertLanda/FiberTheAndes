document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const errorMsg = document.getElementById('login-error');
    const btnLogout = document.getElementById('btn-logout');
    const ticketsList = document.getElementById('tickets-list');
    const totalTicketsEl = document.getElementById('total-tickets');

    // Credenciales hardcodeadas (Solo como demo en front-end)
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'admin123';

    // Check auth state
    if (sessionStorage.getItem('admin_auth') === 'true') {
        showDashboard();
    }

    // Login Handle
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            sessionStorage.setItem('admin_auth', 'true');
            showDashboard();
        } else {
            errorMsg.textContent = 'Usuario o contraseña incorrectos.';
        }
    });

    // Logout Handle
    btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('admin_auth');
        dashboardContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        document.getElementById('admin-pass').value = '';
    });

    function showDashboard() {
        loginContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');

        // Referencias a filtros
        const filterStatus = document.getElementById('filter-status');
        const filterType = document.getElementById('filter-type');

        // Calculadora de tiempo
        const calculateDays = (date) => {
            return Math.floor((new Date() - new Date(date)) / 86400000);
        };

        const timeAgo = (date) => {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " años";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " meses";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " días";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " horas";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " minutos";
            return Math.floor(seconds) + " segundos";
        };

        // Pinta las quejas en la tabla (tarjetas de tickets)
        const loadComplaints = async () => {
            let tickets = [];
            try {
                const res = await fetch('http://localhost:3000/api/tickets');
                if (res.ok) tickets = await res.json();
            } catch(e) { console.error('Error cargando tickets:', e); }

            const suggestionsList = document.getElementById('suggestions-list');
            
            ticketsList.innerHTML = '';
            if (suggestionsList) suggestionsList.innerHTML = '';
            
            // Contar reportes previos por DNI
            const dniCounts = {};
            tickets.forEach(t => {
                if (t.data && t.data.dni && t.data.dni.toLowerCase() !== 'no especificado') {
                    dniCounts[t.data.dni] = (dniCounts[t.data.dni] || 0) + 1;
                }
            });

            // Actualizar métricas top
            document.getElementById('total-tickets').textContent = tickets.length;
            const resolvedCount = tickets.filter(t => t.status === 'resuelto').length;
            const pendingCount = tickets.filter(t => t.status !== 'resuelto').length;
            
            if (document.getElementById('resolved-complaints')) document.getElementById('resolved-complaints').textContent = resolvedCount;
            if (document.getElementById('pending-complaints')) document.getElementById('pending-complaints').textContent = pendingCount;

            // Aplicar filtros a la bandeja principal
            const statusVal = filterStatus ? filterStatus.value.toLowerCase() : 'all';
            const typeVal = filterType ? filterType.value.toLowerCase() : 'all';

            let inboxTickets = tickets.filter(t => !(t.data.tipo || '').toLowerCase().includes('sugerencia'));
            let suggestionTickets = tickets.filter(t => (t.data.tipo || '').toLowerCase().includes('sugerencia'));

            if (statusVal !== 'all') {
                inboxTickets = inboxTickets.filter(t => (t.status || 'pendiente').toLowerCase() === statusVal);
            }
            if (typeVal !== 'all') {
                inboxTickets = inboxTickets.filter(t => {
                    const tipo = (t.data.tipo || 'Sin Clasificar').toLowerCase();
                    if (typeVal === 'falla técnica') return tipo.includes('falla');
                    if (typeVal === 'sugerencia') return false; // ya filtrados
                    if (typeVal === 'queja comercial') return tipo.includes('queja') || tipo.includes('comercial');
                    return true;
                });
            }

            const renderTicket = (ticket, container) => {
                const data = ticket.data || {};
                const date = new Date(ticket.timestamp).toLocaleString();
                const timeOpen = timeAgo(ticket.timestamp);
                const daysOpen = calculateDays(ticket.timestamp);
                
                const tipo = data.tipo || 'Sin Clasificar';
                const isSugerencia = tipo.toLowerCase().includes('sugerencia');
                const colorTipo = tipo.toLowerCase().includes('falla') ? '#e74c3c' : 
                                  isSugerencia ? '#2ecc71' : '#f39c12';
                
                let isResolved = false;
                let ticketStateColor = '#e74c3c'; 
                let ticketStateLabel = 'PENDIENTE';

                // Lógica de colores según estado y tiempo
                if (ticket.status === 'resuelto') {
                    isResolved = true;
                    ticketStateColor = '#2ecc71'; 
                    ticketStateLabel = 'RESUELTO';
                } else if (ticket.status === 'proceso') {
                    ticketStateColor = '#f1c40f'; 
                    ticketStateLabel = 'EN PROCESO';
                } else {
                    if (daysOpen >= 10 && !isSugerencia) {
                        ticketStateColor = '#9b59b6'; // Morado (crítico)
                        ticketStateLabel = 'CRÍTICO/ATRASADO';
                    }
                }
                
                // Reportes Previos
                let historyBadge = '';
                if (data.dni && data.dni.toLowerCase() !== 'no especificado' && dniCounts[data.dni] > 1) {
                    historyBadge = `<span style="background:#e74c3c; color:white; padding:2px 6px; border-radius:10px; font-size:11px; margin-left:10px; font-weight:bold;"><i class="fas fa-exclamation-circle"></i> ${dniCounts[data.dni]} reportes totales</span>`;
                }

                // Generar los botones de acción dependiendo del estado
                let actionsHTML = '';
                if (!isResolved) {
                    if (ticket.status !== 'proceso' && !isSugerencia) {
                        actionsHTML += `<button class="btn btn-warning btn-sm btn-process" data-id="${ticket.id}" style="background-color:#f1c40f; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; margin-right:5px;"><i class="fas fa-hammer"></i> En Proceso</button>`;
                    }
                    actionsHTML += `<button class="btn btn-secondary btn-sm btn-resolve" data-id="${ticket.id}" style="background-color:#2ecc71; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;"><i class="fas fa-check"></i> ${isSugerencia ? 'Marcar Leído' : 'Confirmar Resuelto'}</button>`;
                } else {
                    actionsHTML = `<span style="color:green; font-weight:bold;"><i class="fas fa-check-double"></i> ${isSugerencia ? 'Leída' : 'Solucionado'}</span>`;
                }

                const ticketHTML = `
                    <div class="ticket-card" style="border-left: 5px solid ${ticketStateColor}; opacity: ${isResolved ? '0.7' : '1'}; background-color: #fff; padding: 15px; margin-bottom: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <div class="ticket-header" style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <span class="ticket-id" style="font-weight:bold; color:#555;">#TICKET-${ticket.id}</span>
                            <span class="ticket-date" style="color:#888; font-size:12px;">${date} <span style="color:${ticketStateColor}; font-weight:bold; margin-left: 5px;"><i class="fas fa-history"></i> Hace ${timeOpen}</span></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div class="ticket-type" style="background-color: ${colorTipo}20; color: ${colorTipo}; padding: 4px 8px; border-radius: 4px; display: inline-block; font-weight: bold; font-size: 0.8rem;">
                                ${tipo.toUpperCase()}
                            </div>
                            <div style="background-color: ${ticketStateColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">
                                ${ticketStateLabel}
                            </div>
                        </div>
                        <div class="ticket-body" style="font-size: 0.85rem; line-height: 1.5; color:#444;">
                            <div class="ticket-info" style="display:grid; grid-template-columns: 1fr; gap:5px; margin-bottom:10px;">
                                <p style="margin:2px 0;"><strong><i class="fas fa-user"></i> Cliente:</strong> ${data.nombre || 'No registrado'} ${historyBadge}</p>
                                <p style="margin:2px 0;"><strong><i class="fas fa-id-card"></i> DNI/RUC:</strong> ${data.dni || 'No registrado'}</p>
                                <p style="margin:2px 0;"><strong><i class="fas fa-phone"></i> Contacto:</strong> ${data.contacto || 'No registrado'}</p>
                                ${!isSugerencia ? `<p style="margin:2px 0;"><strong><i class="fas fa-network-wired"></i> Servicio:</strong> ${data.servicio || 'No registrado'}</p>` : ''}
                                ${!isSugerencia ? `<p style="margin:2px 0;"><strong><i class="fas fa-map-marker-alt"></i> Ubicación:</strong> ${data.ubicacion || 'No registrado'}</p>` : ''}
                            </div>
                            ${(!isSugerencia && data.tipo && data.tipo.toLowerCase().includes('falla')) ? `
                            <div class="ticket-tech" style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-bottom:10px; background:#f9f9f9; padding:10px; border-radius:4px;">
                                <p style="margin:2px 0;"><strong><i class="fas fa-clock"></i> Falla:</strong> ${data.tiempo || 'N/A'}</p>
                                <p style="margin:2px 0;"><strong><i class="fas fa-wifi"></i> Conexión:</strong> ${data.conexion || 'N/A'}</p>
                                <p style="margin:2px 0; grid-column: 1/-1;"><strong><i class="fas fa-sync-alt"></i> Reinició:</strong> ${data.reinicio || 'N/A'}</p>
                            </div>
                            ` : ''}
                        </div>
                        <div class="ticket-problem" style="margin-top:10px; padding-top:10px; border-top:1px solid #eee;">
                            <strong style="color:${isSugerencia ? '#2ecc71' : '#e74c3c'};"><i class="${isSugerencia ? 'fas fa-lightbulb' : 'fas fa-exclamation-triangle'}"></i> Mensaje:</strong>
                            <p style="margin-top:5px; font-size: 0.9rem;">${data.problema || 'Sin detalles proporcionados'}</p>
                        </div>
                        <div class="ticket-footer" style="margin-top:15px; display:flex; justify-content:flex-end;">
                            <div class="ticket-actions">
                                ${actionsHTML}
                            </div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', ticketHTML);
            };

            if (inboxTickets.length === 0) {
                ticketsList.innerHTML = '<p class="empty-state">No hay tickets que coincidan.</p>';
            } else {
                inboxTickets.slice().reverse().forEach(t => renderTicket(t, ticketsList));
            }

            if (suggestionsList) {
                if (suggestionTickets.length === 0) {
                    suggestionsList.innerHTML = '<p class="empty-state" style="font-size:14px;">No hay sugerencias recientes.</p>';
                } else {
                    // Mostrar sugerencias más nuevas primero limitadas a las últimas 10
                    suggestionTickets.slice().reverse().slice(0, 10).forEach(t => renderTicket(t, suggestionsList));
                }
            }

            // Añadir listeners a los botones de resolver
            document.querySelectorAll('.btn-resolve').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.closest('button').getAttribute('data-id'));
                    resolveTicket(id);
                });
            });

            // Añadir listeners a los botones de en proceso
            document.querySelectorAll('.btn-process').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.closest('button').getAttribute('data-id'));
                    processTicket(id);
                });
            });
        };

        const resolveTicket = async (id) => {
            if(confirm('¿Seguro que deseas marcar este ticket como Resuelto?')) {
                try {
                    await fetch(`http://localhost:3000/api/tickets/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'resuelto' })
                    });
                    loadComplaints();
                } catch(e) { console.error(e); }
            }
        };

        const processTicket = async (id) => {
            if(confirm('¿Marcar este ticket como "En Proceso"? (Avisar a equipo técnico)')) {
                try {
                    await fetch(`http://localhost:3000/api/tickets/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'proceso' })
                    });
                    loadComplaints();
                } catch(e) { console.error(e); }
            }
        };

        // Listeners de filtros
        if(filterStatus) filterStatus.addEventListener('change', loadComplaints);
        if(filterType) filterType.addEventListener('change', loadComplaints);

        loadComplaints();
    }
});
