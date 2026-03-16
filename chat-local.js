document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    //  CHATBOT LOCAL - Funciona sin servidor externo
    // ============================================================
    
    // Widget HTML
    const helpdeskHTML = `
        <div id="helpdesk-bubble" class="helpdesk-bubble">
            <i class="fas fa-headset"></i>
            <span class="helpdesk-bubble-badge" id="helpdesk-badge" style="display:none;">1</span>
        </div>
        <div id="helpdesk-widget" class="helpdesk-closed">
            <div id="helpdesk-header">
                <div style="display: flex; align-items: center;">
                    <img src="img/LOGO FTA.png" alt="FTA" style="height: 24px; margin-right: 10px;">
                    <i class="fas fa-headset" style="margin-right: 8px; color: white;"></i>
                    <span>Soporte IA</span>
                </div>
                <button id="helpdesk-close-btn"><i class="fas fa-times"></i></button>
            </div>
            <div id="helpdesk-body">
                <div id="helpdesk-messages"></div>
                <div id="helpdesk-typing" class="helpdesk-typing hidden">
                    <span></span><span></span><span></span>
                </div>
                <div id="helpdesk-options" class="helpdesk-options hidden" style="padding: 10px; display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;">
                </div>
                <div id="helpdesk-input-area">
                    <textarea id="helpdesk-input" placeholder="Escribe tu mensaje..." autocomplete="off" rows="1"></textarea>
                    <button id="helpdesk-send"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', helpdeskHTML);

    const widget          = document.getElementById('helpdesk-widget');
    const header          = document.getElementById('helpdesk-header');
    const bubble          = document.getElementById('helpdesk-bubble');
    const badge           = document.getElementById('helpdesk-badge');
    const closeBtn        = document.getElementById('helpdesk-close-btn');
    const messagesEl      = document.getElementById('helpdesk-messages');
    const typingEl        = document.getElementById('helpdesk-typing');
    const inputField      = document.getElementById('helpdesk-input');
    const sendBtn         = document.getElementById('helpdesk-send');

    // Session storage
    let sessionId = sessionStorage.getItem('ftc_session_id');
    if (!sessionId) {
        sessionId = 'u_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        sessionStorage.setItem('ftc_session_id', sessionId);
    }
    const MSG_KEY = `ftc_msgs_${sessionId}`;

    let messages = JSON.parse(sessionStorage.getItem(MSG_KEY)) || [];
    let ticketData = {};
    let collectingTicket = false;
    let ticketType = '';
    let ticketStep = 0;

    // Sistema de recolección de tickets
    const ticketSteps = {
        'Falla Técnica': [
            { field: 'nombre', question: '¿Cuál es tu **nombre completo**?' },
            { field: 'dni', question: '¿Cuál es tu **DNI o RUC**?' },
            { field: 'servicio', question: '¿Qué **servicio** tienes contratado con nosotros?' },
            { field: 'ubicacion', question: '¿Cuál es tu **dirección exacta** para verificar cobertura?' },
            { field: 'contacto', question: '¿Cuál es tu **teléfono o email** de contacto?' },
            { field: 'problema', question: 'Describe el **problema técnico** que estás experimentando:' },
            { field: 'tiempo', question: '¿Desde **cuándo** tienes este problema?' },
            { field: 'conexion', question: '¿Es por **WiFi o cable**?' },
            { field: 'reinicio', question: '¿Ya **reiniciaste** los equipos?' }
        ],
        'Queja Comercial': [
            { field: 'nombre', question: '¿Cuál es tu **nombre completo**?' },
            { field: 'dni', question: '¿Cuál es tu **DNI o RUC**?' },
            { field: 'servicio', question: '¿Qué **servicio** está relacionado con tu queja?' },
            { field: 'ubicacion', question: '¿Cuál es tu **dirección**?' },
            { field: 'contacto', question: '¿Cuál es tu **teléfono o email** de contacto?' },
            { field: 'problema', question: 'Describe tu **queja o reclamo** en detalle:' }
        ],
        'Sugerencia': [
            { field: 'nombre', question: '¿Cuál es tu **nombre**?' },
            { field: 'contacto', question: '¿Cuál es tu **email o teléfono** (opcional)?' },
            { field: 'problema', question: 'Cuéntame tu **sugerencia o idea** para mejorar:' }
        ]
    };

    // Función para guardar ticket localmente
    const saveTicketLocal = (ticket) => {
        try {
            // Intentar guardar en localStorage como fallback
            let tickets = JSON.parse(localStorage.getItem('ftc_local_tickets') || '[]');
            tickets.push(ticket);
            localStorage.setItem('ftc_local_tickets', JSON.stringify(tickets));
            
            // También intentar guardar en el archivo del backend si está disponible
            fetch('/tickets-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticket)
            }).catch(() => {
                console.log('Guardando ticket solo en localStorage (backend no disponible)');
            });
            
            return true;
        } catch (e) {
            console.error('Error guardando ticket:', e);
            return false;
        }
    };

    // Función para iniciar recolección de ticket
    const startTicketCollection = (type) => {
        collectingTicket = true;
        ticketType = type;
        ticketStep = 0;
        ticketData = {
            tipo: type,
            sessionId: sessionId
        };
        
        const steps = ticketSteps[type];
        if (steps && steps[0]) {
            addMessage(`Has seleccionado **${type}**. Voy a recopilar algunos datos para ayudarte mejor.`, 'bot');
            setTimeout(() => {
                addMessage(steps[0].question, 'bot');
            }, 1000);
        }
    };

    // Función para procesar respuesta del ticket
    const processTicketResponse = (userText) => {
        const steps = ticketSteps[ticketType];
        if (!steps || ticketStep >= steps.length) {
            finishTicketCollection();
            return null;
        }

        const currentStep = steps[ticketStep];
        ticketData[currentStep.field] = userText;
        ticketStep++;

        if (ticketStep >= steps.length) {
            finishTicketCollection();
            return null;
        }

        return steps[ticketStep].question;
    };

    // Función para finalizar recolección de ticket
    const finishTicketCollection = () => {
        collectingTicket = false;
        
        const ticket = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            data: {
                ...ticketData,
                servicio: ticketData.servicio || 'No especificado',
                tiempo: ticketData.tiempo || 'N/A',
                conexion: ticketData.conexion || 'N/A',
                reinicio: ticketData.reinicio || 'N/A',
                ubicacion: ticketData.ubicacion || 'No especificado',
                contacto: ticketData.contacto || 'No especificado'
            },
            status: 'pendiente'
        };

        const saved = saveTicketLocal(ticket);
        
        if (saved) {
            addMessage(`✅ **¡Ticket registrado con éxito!**\n\nTu caso (#${ticket.id}) ha sido guardado en nuestro sistema.\n\n**Resumen:**\n• Tipo: ${ticketData.tipo}\n• Nombre: ${ticketData.nombre}\n• Contacto: ${ticketData.contacto}\n\nUno de nuestros especialistas se contactará contigo pronto.`, 'bot');
            
            // Reset para nuevo ticket
            setTimeout(() => {
                addMessage('¿Hay algo más en lo que pueda ayudarte?', 'bot');
            }, 3000);
        } else {
            addMessage('❌ Lo siento, hubo un error al guardar tu ticket. Por favor, intenta nuevamente o llámanos directamente al **01 7410392**.', 'bot');
        }
        
        ticketData = {};
        ticketType = '';
        ticketStep = 0;
    };
    const knowledgeBase = {
        company: "Fiber The Andes es una empresa peruana de Internet Corporativo 100% dedicado.",
        services: "Ofrecemos Internet Dedicado, Interconexión L2L e Infraestructura de red.",
        coverage: "Brindamos servicio a clientes empresariales e instituciones en la sierra central y Lima.",
        contact: "Central nacional: 01 7410392. WhatsApp: 934046181.",
        support: "Soporte técnico 24/7 especializado."
    };

    // Respuestas predefinidas para patrones comunes
    const getBotResponse = (userText) => {
        const text = userText.toLowerCase().trim();
        
        // Si estamos recolectando un ticket, procesar la respuesta
        if (collectingTicket) {
            const nextQuestion = processTicketResponse(userText);
            if (nextQuestion) {
                const prefixes = ["Perfecto.", "Anotado.", "Gracias.", "Excelente.", "Entendido."];
                const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                return `${randomPrefix} ${nextQuestion}`;
            }
            return null; // El ticket se finalizó
        }
        
        // Saludos
        if (text.includes('hola') || text.includes('ola') || text.includes('buenos') || text.includes('buenas')) {
            return "¡Hola! 👋 Soy el asistente virtual de Fiber The Andes. Puedo ayudarte con:\n\n🔧 **Reportes técnicos**\n📞 **Consultas sobre servicios**\n💡 **Sugerencias y quejas**\n\n¿Qué necesitas hoy?";
        }
        
        // Información sobre la empresa
        if (text.includes('quién') || text.includes('qui') || text.includes('empresa') || text.includes('sobre')) {
            return `${knowledgeBase.company} ${knowledgeBase.services} ${knowledgeBase.coverage}`;
        }
        
        // Servicios
        if (text.includes('servicio') || text.includes('ofrecen') || text.includes('planes')) {
            return `Nuestros servicios principales son:\n• Internet Dedicado 100%\n• Interconexión L2L\n• Infraestructura de red\n\nTodos con soporte 24/7 especializado.\n\n¿Te gustaría reportar algún problema técnico?`;
        }
        
        // Contacto
        if (text.includes('contacto') || text.includes('teléfono') || text.includes('llamar') || text.includes('whatsapp')) {
            return `Puedes contactarnos por:\n📞 Central: ${knowledgeBase.contact}\n📱 WhatsApp: 934046181\n📧 Email: comercial@fibertheandes.com\n\n¿Necesitas reportar algún inconveniente?`;
        }
        
        // Cobertura
        if (text.includes('cobertura') || text.includes('dónde') || text.includes('lugar')) {
            return `${knowledgeBase.coverage} Para verificar cobertura específica, por favor proporciona tu dirección.\n\n¿Quieres reportar un problema técnico en tu ubicación?`;
        }
        
        // Soporte técnico - Iniciar recolección de ticket
        if (text.includes('falla') || text.includes('problema') || text.includes('no funciona') || text.includes('lento') || text.includes('internet') || text.includes('conexión')) {
            startTicketCollection('Falla Técnica');
            return null; // La respuesta vendrá del sistema de tickets
        }
        
        // Quejas - Iniciar recolección de ticket
        if (text.includes('queja') || text.includes('reclamo') || text.includes('mala atención') || text.includes('insatisfecho') || text.includes('mal servicio')) {
            startTicketCollection('Queja Comercial');
            return null; // La respuesta vendrá del sistema de tickets
        }
        
        // Sugerencias - Iniciar recolección de ticket
        if (text.includes('sugerencia') || text.includes('idea') || text.includes('mejorar') || text.includes('recomendación')) {
            startTicketCollection('Sugerencia');
            return null; // La respuesta vendrá del sistema de tickets
        }
        
        // Palabras clave para tickets técnicos
        if (text.includes('técnico') || text.includes('soporte') || text.includes('ayuda') || text.includes('error') || text.includes('avería')) {
            return "Entiendo que necesitas ayuda técnica. Puedo registrar un ticket de soporte para ti.\n\n¿Deseas reportar una **falla técnica**, hacer una **queja comercial** o enviar una **sugerencia**?";
        }
        
        // Respuesta por defecto con opciones claras
        return `Puedo ayudarte con:\n\n� **Fallas Técnicas** - Reporta problemas de internet\n📞 **Quejas Comerciales** - Comentarios sobre el servicio\n� **Sugerencias** - Ideas para mejorar\n� **Información** - Servicios, contacto, cobertura\n\n¿Qué necesitas específicamente?`;
    };

    // Render functions
    const render = () => {
        messagesEl.innerHTML = '';
        messages.forEach(m => {
            const el = document.createElement('div');
            el.className = `helpdesk-message ${m.sender}`;
            el.innerHTML = m.text.replace(/\n/g, '<br>');
            messagesEl.appendChild(el);
        });
        messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const addMessage = (text, sender) => {
        messages.push({ text, sender, ts: new Date().toISOString() });
        sessionStorage.setItem(MSG_KEY, JSON.stringify(messages));
        render();
        
        if (sender === 'bot' && widget.classList.contains('helpdesk-closed')) {
            badge.style.display = 'block';
        }
    };

    const showTyping = (show) => {
        typingEl.classList.toggle('hidden', !show);
        if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    // Procesar mensaje del usuario
    const process = async (userText) => {
        if (!userText || userText.replace(/\s/g,'').length === 0) return;

        addMessage(userText, 'user');
        inputField.disabled = true;
        sendBtn.disabled = true;
        showTyping(true);

        // Simular tiempo de respuesta
        setTimeout(() => {
            const botReply = getBotResponse(userText);
            showTyping(false);
            
            if (botReply) {
                addMessage(botReply, 'bot');
            }
            
            inputField.disabled = false;
            sendBtn.disabled = false;
            inputField.focus();
        }, 1000 + Math.random() * 1000);
    };

    // Auto-expandir campo de texto
    const autoExpandTextarea = () => {
        inputField.style.height = 'auto';
        inputField.style.height = Math.min(inputField.scrollHeight, 120) + 'px';
    };

    inputField.addEventListener('input', autoExpandTextarea);
    inputField.addEventListener('focus', autoExpandTextarea);

    // Toggle widget
    const toggleWidget = () => {
        const isClosed = widget.classList.contains('helpdesk-closed');
        
        if (isClosed) {
            widget.classList.remove('helpdesk-closed');
            bubble.classList.add('hidden-bubble');
            badge.style.display = 'none';
            
            if (messages.length === 0) {
                const welcome = '¡Hola! 👋 Soy el asistente virtual de Fiber The Andes. Estoy aquí para ayudarte con cualquier consulta o problema técnico. ¿En qué te puedo asistir hoy?';
                addMessage(welcome, 'bot');
            }
            setTimeout(() => inputField.focus(), 300);
        } else {
            widget.classList.add('helpdesk-closed');
            bubble.classList.remove('hidden-bubble');
        }
    };

    // Event listeners
    bubble.addEventListener('click', toggleWidget);
    closeBtn.addEventListener('click', toggleWidget);
    
    sendBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        const text = inputField.value.trim();
        inputField.value = '';
        inputField.style.height = 'auto';
        process(text).then(() => {}); 
    });
    
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = inputField.value.trim();
            inputField.value = '';
            inputField.style.height = 'auto';
            process(text);
        }
    });

    render();
});
