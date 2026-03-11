document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    //  CONFIGURACIÓN - Reemplaza con tu API Key de Google Gemini
    //  Obtén una gratis en: https://aistudio.google.com/app/apikey
    // ============================================================
    const GEMINI_API_KEY = 'AIzaSyCr5kDiqlOO7j3z0UATI2R4hWnGf3Qa4no';
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // ============================================================
    //  WIDGET HTML
    // ============================================================
    const helpdeskHTML = `
        <div id="helpdesk-bubble" class="helpdesk-bubble">
            <i class="fas fa-comment-dots"></i>
            <span class="helpdesk-bubble-badge" id="helpdesk-badge" style="display:none;">1</span>
        </div>
        <div id="helpdesk-widget" class="helpdesk-closed">
            <div id="helpdesk-header">
                <div style="display: flex; align-items: center;">
                    <img src="img/LOGO FTA.png" alt="FTA" style="height: 24px; margin-right: 10px; border-radius: 50%; background: white; padding: 2px;">
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
                    <input type="text" id="helpdesk-input" placeholder="Escribe tu mensaje..." autocomplete="off">
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

    // ============================================================
    //  SESSION (Multi-usuario: cada pestaña/dispositivo es único)
    // ============================================================
    let sessionId = localStorage.getItem('ftc_session_id');
    if (!sessionId) {
        sessionId = 'u_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('ftc_session_id', sessionId);
    }
    const MSG_KEY  = `ftc_msgs_${sessionId}`;
    const HIST_KEY = `ftc_hist_${sessionId}`; // Historial para Gemini

    // Helper para conectar al servidor de Node pase lo que pase
    const getApiUrl = (path) => {
        const isMainServer = window.location.port === '3000';
        const isLocalFile = window.location.protocol === 'file:';
        
        // Si no estamos en el puerto 3000 (ej. estamos en el 8080) 
        // o es un archivo local, forzamos localhost:3000
        if (isLocalFile || (!isMainServer && window.location.hostname === 'localhost')) {
            return 'http://localhost:3000' + path;
        }
        // En producción (dominio real), el path relativo "/" es lo correcto
        return path;
    };

    let messages = JSON.parse(localStorage.getItem(MSG_KEY))  || [];
    let history  = JSON.parse(localStorage.getItem(HIST_KEY)) || [];

    // ============================================================
    //  SISTEMA PROMPT — Le dice a Gemini quién es y qué recopilar
    // ============================================================
    const SYSTEM_PROMPT = `
Eres el asistente virtual corporativo de "Fiber The Andes", empresa peruana de Internet Corporativo 100% dedicado.
Tu principal misión no solo es soporte técnico, sino funcionar como un HELPDESK INTEGRAL para recibir:
A) Problemas de conexión
B) Quejas sobre el servicio o atención
C) Sugerencias o cualquier otro reclamo.

COMPORTAMIENTO:
- Responde siempre de forma muy amable, profesional y empática, sobre todo si es una queja.
- Entiende la mala ortografía (cacofonía) sin corregir al cliente. 
- Puedes resolver dudas rápidas (cobertura nacional, soporte 24/7, planes personalizados llamando al 01 7410392).

OBJETIVO DE RECOPILACIÓN: Cuando detectes que el usuario quiere reportar una falla, dejar una queja o hacer una sugerencia, debes recopilar conversacionalmente estos datos:
1. tipo_reporte: (Debes clasificarlo tú mismo: "Falla Técnica", "Queja Comercial", o "Sugerencia")
2. detalle: Todo el detalle o descripción de su problema, queja o sugerencia.
3. nombre: Nombre y apellido del cliente
4. dni: DNI o RUC
5. servicio: Tipo de servicio que tiene contratado
6. ubicacion: Su dirección o ubicación
7. contacto: Celular o E-mail para llamarle

(Solo si es una Falla Técnica, pregunta opcionalmente las siguientes 3 cosas):
8. tiempo: ¿Desde cuándo falla?
9. conexion: ¿WiFi o Cable?
10. reinicio: ¿Ya reinició equipos?

REGLAS DE ORO:
- NO hagas todas las preguntas de golpe. Haz 1 o 2 máximo por mensaje.
- Sé fluido y natural, como un humano apuntando datos.
- Si ya te dio un dato, no lo vuelvas a preguntar.

FINALIZACIÓN: Cuando tengas los datos mínimos necesarios (tipo, detalle, nombre, dni, ubicacion, contacto), al final de tu mensaje de despedida incluye EXACTAMENTE este bloque JSON oculto:

\`\`\`ticket_data
{"tipo":"...","problema":"(poner aquí el detalle)","nombre":"...","dni":"...","servicio":"...","tiempo":"...","conexion":"...","reinicio":"...","ubicacion":"...","contacto":"..."}
\`\`\`
`.trim();

    // ============================================================
    //  RENDER
    // ============================================================
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
        localStorage.setItem(MSG_KEY, JSON.stringify(messages));
        render();
        
        // Show notification badge if closed and bot messages
        if (sender === 'bot' && widget.classList.contains('helpdesk-closed')) {
            badge.style.display = 'block';
        }
    };

    const showTyping = (show) => {
        typingEl.classList.toggle('hidden', !show);
        if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    // ============================================================
    //  PARSEAR TICKET DEL MENSAJE DEL BOT
    // ============================================================
    const extractTicket = async (botText) => {
        const match = botText.match(/```ticket_data\s*([\s\S]*?)```/);
        if (match) {
            try {
                const data = JSON.parse(match[1].trim());
                const ticketData = {
                    id: Date.now(),
                    sessionId,
                    timestamp: new Date().toISOString(),
                    data,
                    status: 'pendiente'
                };
                
                await fetch(getApiUrl('/tickets-manager'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ticketData)
                });
                
                // Devuelve el texto limpio (sin el bloque JSON)
                return botText.replace(/```ticket_data[\s\S]*?```/g, '').trim();
            } catch(e) {
                console.error('Error guardando ticket:', e);
                return botText;
            }
        }
        return botText;
    };

    // ============================================================
    //  LLAMAR AL BACKEND (NODE.JS) EN VEZ DE A GEMINI DIRECTO
    // ============================================================
    let aiCache = JSON.parse(localStorage.getItem('ftc_ai_cache')) || {};

    const callGemini = async (userText) => {
        // En lugar de llamar a la URL de Google, llamamos a nuestro propio servidor local
        const BACKEND_URL = getApiUrl('/chat-handler');

        const body = {
            messages: history, // Enviamos el historial completo para que el backend lo organice
            userText: userText
        };

        const checkCacheOrFallback = (userTxt) => {
            const lowerTxt = userTxt.toLowerCase().trim();
            if (aiCache[lowerTxt]) {
                const cachedRes = aiCache[lowerTxt];
                if (!cachedRes.includes('```ticket_data')) {
                    return cachedRes;
                }
            }
            
            // Handle greetings
            const greetings = ['hola', 'ola', 'buenos', 'buenas', 'saludos', 'hey', 'q tal'];
            const isGreeting = greetings.some(g => lowerTxt.includes(g));
            
            if (isGreeting) {
                return '__SHOW_OPTIONS_GREETING__';
            }
            return '__SHOW_OPTIONS__';
        };

        try {
            const res = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                let errMsg = errJson?.error?.message || `HTTP ${res.status}`;
                console.error('Gemini API Error:', errMsg, errJson);
                history.pop();
                
                // Si la Key fue bloqueada por Google (400) o está saturada (429/503), forzamos modo de Respaldo Manual
                if (res.status === 429 || res.status === 503 || res.status === 400 || res.status === 403) {
                    return checkCacheOrFallback(userText);
                }
                
                return `Error al conectar (${errMsg}). Llámanos al **01 7410392**.`;
            }

            const json = await res.json();
            const rawText = json.text || null;

            if (!rawText) {
                console.error('Respuesta vacía del servidor:', JSON.stringify(json));
                history.pop();
                return 'El asistente no respondió. Por favor intenta de nuevo.';
            }

            history.push({ role: 'model', parts: [{ text: rawText }] });
            localStorage.setItem(HIST_KEY, JSON.stringify(history));

            // Parsear y guardar respuesta en caché si no contiene la recolección de tickets
            const cleanText = await extractTicket(rawText);
            if (!rawText.includes('```ticket_data')) {
                const lowerTxt = userText.toLowerCase().trim();
                if (lowerTxt.length > 3) {
                    aiCache[lowerTxt] = rawText;
                    localStorage.setItem('ftc_ai_cache', JSON.stringify(aiCache));
                }
            }

            return cleanText;
        } catch (e) {
            console.error('Error de red Gemini:', e);
            history.pop();
            return checkCacheOrFallback(userText);
        }
    };

    // ============================================================
    //  PROCESAR ENVÍO
    // ============================================================
    const process = async (userText) => {
        if (!userText || userText.replace(/\s/g,'').length === 0) return;

        addMessage(userText, 'user');
        inputField.disabled = true;
        sendBtn.disabled = true;
        showTyping(true);

        // Check if we are in manual fallback ticket mode (collecting steps)
        const manualStep = sessionStorage.getItem('ftc_manual_ticket_mode');
        if (manualStep) {
            showTyping(false);
            let manualData = JSON.parse(sessionStorage.getItem('ftc_manual_data') || '{}');
            let steps = JSON.parse(sessionStorage.getItem('ftc_manual_ticket_steps') || '[]');
            
            // Save answer for current step
            manualData[manualStep] = userText;
            sessionStorage.setItem('ftc_manual_data', JSON.stringify(manualData));
            
            // Remove the current step from the array
            steps.shift();
            sessionStorage.setItem('ftc_manual_ticket_steps', JSON.stringify(steps));
            
            if (steps.length > 0) {
                // Ask next step
                const nextStep = steps[0];
                sessionStorage.setItem('ftc_manual_ticket_mode', nextStep);
                
                const stepQuestions = {
                    'nombre': "¿Cuál es tu **Nombre completo**?",
                    'dni': "¿Cuál es tu **DNI o RUC**?",
                    'direccion': "¿Cuál es tu **Dirección exacta** para revisar cobertura técnica?",
                    'telefono': "¿Cuál es tu **Número de celular o teléfono** de contacto?",
                    'detalle': "Por favor **detalla brevemente tu solicitud, problema o sugerencia**:"
                };
                
                const prefixes = ["Perfecto.", "Anotado.", "Gracias.", "Excelente.", "Bien."];
                const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                addMessage(`${randomPrefix} ${stepQuestions[nextStep]}`, 'bot');
                
            } else {
                // Finished
                const fallbackTipo = sessionStorage.getItem('ftc_manual_ticket_type') || 'Falla Técnica';
                
                const ticketData = {
                    id: Date.now(),
                    sessionId,
                    timestamp: new Date().toISOString(),
                    data: {
                        tipo: fallbackTipo + " (Manual)",
                        problema: manualData.detalle || "N/A",
                        nombre: manualData.nombre || "N/A",
                        dni: manualData.dni || "N/A",
                        servicio: "No especificado",
                        tiempo: "N/A",
                        conexion: "N/A",
                        reinicio: "N/A",
                        ubicacion: manualData.direccion || "N/A",
                        contacto: manualData.telefono || "N/A"
                    },
                    status: 'pendiente'
                };
                
                try {
                    const res = await fetch(getApiUrl('/tickets-manager'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(ticketData)
                    });
                    
                    if (!res.ok) throw new Error('Servidor no disponible');

                    // Success - Clear state
                    sessionStorage.removeItem('ftc_manual_ticket_mode');
                    sessionStorage.removeItem('ftc_manual_ticket_type');
                    sessionStorage.removeItem('ftc_manual_data');
                    sessionStorage.removeItem('ftc_manual_ticket_steps');
                    
                    addMessage("✅ ¡Completado! He ingresado tus datos y registrado tu caso formalmente en nuestro panel. Uno de nuestros ingenieros o asesores se contactará contigo a la brevedad.", 'bot');
                } catch(e) { 
                    console.error('Falló guardar ticket manual', e); 
                    addMessage("⚠️ Lo siento, parece que mi sistema de reportes no está respondiendo ahora mismo. Por favor, intenta de nuevo en unos minutos o llámanos directamente al **01 7410392**.", 'bot');
                }
            }
            
            inputField.disabled = false;
            sendBtn.disabled = false;
            inputField.focus();
            return;
        }

        const botReply = await callGemini(userText);
        showTyping(false);
        
        if (botReply === '__SHOW_OPTIONS__' || botReply === '__SHOW_OPTIONS_GREETING__') {
            const msg = botReply === '__SHOW_OPTIONS_GREETING__' 
                ? "¡Hola! ¿En qué podemos ayudarte hoy? Por favor, selecciona una opción:" 
                : "Para poder ayudarte mejor, por favor selecciona qué deseas hacer:";
            addMessage(msg, 'bot');
            
            const optionsEl = document.getElementById('helpdesk-options');
            optionsEl.innerHTML = `
                <button class="fallback-btn" data-type="Falla Técnica" style="flex:1; padding:8px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-tools"></i> Falla Técnica</button>
                <button class="fallback-btn" data-type="Queja Comercial" style="flex:1; padding:8px; background:#f39c12; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-angry"></i> Queja</button>
                <button class="fallback-btn" data-type="Sugerencia" style="flex:1; padding:8px; background:#2ecc71; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-lightbulb"></i> Sugerencia</button>
                <button class="fallback-btn" data-type="Info" style="width:100%; margin-top:5px; padding:8px; background:#34495e; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-info-circle"></i> Saber más sobre Fiber The Andes</button>
            `;
            optionsEl.classList.remove('hidden');
            
            optionsEl.querySelectorAll('.fallback-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tipo = e.target.closest('button').getAttribute('data-type');
                    optionsEl.classList.add('hidden');
                    optionsEl.innerHTML = ''; // Elimina los botones completamente
                    
                    if (tipo === 'Info') {
                        addMessage('Saber más sobre Fiber The Andes', 'user');
                        addMessage('Somos Fiber The Andes, una empresa peruana de Internet Corporativo 100% dedicado. Brindamos servicio a clientes empresariales e instituciones en la sierra central y Lima. Nuestra central nacional es el **01 7410392**. También atendemos vía WhatsApp o Correo. ¿Deseas generar algún ticket?', 'bot');
                        return;
                    }
                    
                    // Shuffle form questions
                    const steps = ['nombre', 'dni', 'direccion', 'telefono', 'detalle'].sort(() => Math.random() - 0.5);
                    sessionStorage.setItem('ftc_manual_ticket_steps', JSON.stringify(steps));
                    sessionStorage.setItem('ftc_manual_ticket_mode', steps[0]);
                    sessionStorage.setItem('ftc_manual_ticket_type', tipo);
                    sessionStorage.setItem('ftc_manual_data', JSON.stringify({}));
                    
                    addMessage(tipo, 'user');
                    addMessage(`Has seleccionado **${tipo}**.\nCrearemos tu reporte paso a paso.`, 'bot');
                    
                    const stepQuestions = {
                        'nombre': "¿Cuál es tu **Nombre completo**?",
                        'dni': "¿Cuál es tu **DNI o RUC**?",
                        'direccion': "¿Cuál es tu **Dirección exacta** para revisar cobertura técnica?",
                        'telefono': "¿Cuál es tu **Número de celular o teléfono** de contacto?",
                        'detalle': "Por favor **detalla brevemente tu solicitud, problema o sugerencia**:"
                    };
                    addMessage(`Para empezar, ${stepQuestions[steps[0]]}`, 'bot');
                });
            });
        } else {
            addMessage(botReply, 'bot');
        }

        inputField.disabled = false;
        sendBtn.disabled = false;
        inputField.focus();
    };

    // ============================================================
    //  TOGGLE WIDGET
    // ============================================================
    const toggleWidget = () => {
        const isClosed = widget.classList.contains('helpdesk-closed');
        
        if (isClosed) {
            // Opening
            widget.classList.remove('helpdesk-closed');
            bubble.classList.add('hidden-bubble');
            badge.style.display = 'none'; // clear badge
            
            if (messages.length === 0) {
                // Primer mensaje automático del bot
                const welcome = '¡Hola! 👋 Soy el asistente virtual de Fiber The Andes. Puedo ayudarte con reportes técnicos, consultas sobre nuestros servicios o lo que necesites. ¿En qué te puedo ayudar hoy?';
                addMessage(welcome, 'bot');
                history.push({ role: 'model', parts: [{ text: welcome }] });
                localStorage.setItem(HIST_KEY, JSON.stringify(history));
            }
            setTimeout(() => inputField.focus(), 300);
        } else {
            // Closing
            widget.classList.add('helpdesk-closed');
            bubble.classList.remove('hidden-bubble');
        }
    };

    bubble.addEventListener('click', toggleWidget);
    closeBtn.addEventListener('click', toggleWidget);
    
    sendBtn.addEventListener('click', (e) => { e.stopPropagation(); process(inputField.value.trim()).then(() => {}); inputField.value = ''; });
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const text = inputField.value.trim();
            inputField.value = '';
            process(text);
        }
    });

    render();
});
