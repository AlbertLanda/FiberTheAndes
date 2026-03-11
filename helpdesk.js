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
        <div id="helpdesk-widget" class="helpdesk-closed">
            <div id="helpdesk-header">
                <span><i class="fas fa-headset" style="margin-right:8px;"></i> Soporte / Quejas</span>
                <button id="helpdesk-toggle-btn"><i class="fas fa-chevron-up"></i></button>
            </div>
            <div id="helpdesk-body">
                <div id="helpdesk-messages"></div>
                <div id="helpdesk-typing" class="helpdesk-typing hidden">
                    <span></span><span></span><span></span>
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
    const toggleBtn       = document.getElementById('helpdesk-toggle-btn');
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
    };

    const showTyping = (show) => {
        typingEl.classList.toggle('hidden', !show);
        if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    // ============================================================
    //  PARSEAR TICKET DEL MENSAJE DEL BOT
    // ============================================================
    const extractTicket = (botText) => {
        const match = botText.match(/```ticket_data\s*([\s\S]*?)```/);
        if (match) {
            try {
                const data = JSON.parse(match[1].trim());
                const tickets = JSON.parse(localStorage.getItem('ftc_helpdesk_tickets')) || [];
                tickets.push({
                    id: Date.now(),
                    sessionId,
                    timestamp: new Date().toISOString(),
                    data,
                    status: 'pendiente'
                });
                localStorage.setItem('ftc_helpdesk_tickets', JSON.stringify(tickets));
                // Devuelve el texto limpio (sin el bloque JSON)
                return botText.replace(/```ticket_data[\s\S]*?```/g, '').trim();
            } catch(e) {
                return botText;
            }
        }
        return botText;
    };

    // ============================================================
    //  LLAMAR A GEMINI
    // ============================================================
    const callGemini = async (userText) => {
        history.push({ role: 'user', parts: [{ text: userText }] });

        const body = {
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: history,
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
        };

        try {
            const res = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                let errMsg = errJson?.error?.message || `HTTP ${res.status}`;
                console.error('Gemini API Error:', errMsg, errJson);
                history.pop();
                
                // Mensaje amigable para límite de cuota gratis
                if (res.status === 429) {
                    return 'Uf, estamos recibiendo muchos mensajes ahora mismo y mi servidor está saturado. 😅 Por favor, espera un minuto y vuelve a escribirme.';
                }
                
                return `Error al conectar (${errMsg}). Llámanos al **01 7410392**.`;
            }

            const json = await res.json();
            const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || null;

            if (!rawText) {
                console.error('Respuesta vacía de Gemini:', JSON.stringify(json));
                history.pop();
                return 'El asistente no respondió. Por favor intenta de nuevo.';
            }

            history.push({ role: 'model', parts: [{ text: rawText }] });
            localStorage.setItem(HIST_KEY, JSON.stringify(history));

            return extractTicket(rawText);
        } catch (e) {
            console.error('Error de red Gemini:', e);
            history.pop();
            return 'No pude conectarme al asistente. Verifica tu internet o llámanos al **01 7410392**.';
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

        const botReply = await callGemini(userText);
        showTyping(false);
        addMessage(botReply, 'bot');

        inputField.disabled = false;
        sendBtn.disabled = false;
        inputField.focus();
    };

    // ============================================================
    //  TOGGLE WIDGET
    // ============================================================
    const toggleWidget = () => {
        widget.classList.toggle('helpdesk-closed');
        const closed = widget.classList.contains('helpdesk-closed');
        toggleBtn.querySelector('i').className = closed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';

        if (!closed && messages.length === 0) {
            // Primer mensaje automático del bot
            const welcome = '¡Hola! 👋 Soy el asistente virtual de Fiber The Andes. Puedo ayudarte con reportes técnicos, consultas sobre nuestros servicios o lo que necesites. ¿En qué te puedo ayudar hoy?';
            addMessage(welcome, 'bot');
            history.push({ role: 'model', parts: [{ text: welcome }] });
            localStorage.setItem(HIST_KEY, JSON.stringify(history));
        }
        if (!closed) setTimeout(() => inputField.focus(), 300);
    };

    header.addEventListener('click', toggleWidget);
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
