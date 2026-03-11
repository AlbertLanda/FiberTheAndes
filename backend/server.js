require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Archivos de datos
const kbPath = path.join(__dirname, 'data', 'knowledge_base.txt');
const ticketsPath = path.join(__dirname, 'data', 'tickets.json');

// Inicializar archivo de tickets si no existe
if (!fs.existsSync(ticketsPath)) {
    fs.writeFileSync(ticketsPath, JSON.stringify([]));
}

let knowledgeBase = '';
try {
    knowledgeBase = fs.readFileSync(kbPath, 'utf8');
    console.log('✅ Base de conocimiento cargada correctamente.');
} catch (error) {
    console.error('❌ Error al cargar knowledge_base.txt:', error.message);
}

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// System prompt combining original rules and KB
const SYSTEM_PROMPT = `
Eres el asistente virtual corporativo de "Fiber The Andes", empresa peruana de Internet Corporativo 100% dedicado.
Tu principal misión no solo es soporte técnico, sino funcionar como un HELPDESK INTEGRAL para recibir:
A) Problemas de conexión
B) Quejas sobre el servicio o atención
C) Sugerencias o cualquier otro reclamo.

COMPORTAMIENTO:
- Responde siempre de forma muy amable, profesional y empática, sobre todo si es una queja.
- Entiende la mala ortografía (cacofonía) sin corregir al cliente. 
- Puedes resolver dudas rápidas basándote ESTRICTAMENTE en la "BASE DE CONOCIMIENTO" que está abajo.

BASE DE CONOCIMIENTO DE LA EMPRESA:
-----------------------------------
${knowledgeBase}
-----------------------------------

OBJETIVO DE RECOPILACIÓN: Cuando detectes que el usuario quiere reportar una falla, dejar una queja o hacer una sugerencia, debes recopilar conversacionalmente estos datos:
1. tipo_reporte: ("Falla Técnica", "Queja Comercial", o "Sugerencia")
2. detalle: Todo el detalle o descripción
3. nombre: Nombre y apellido del cliente
4. dni: DNI o RUC
5. servicio: Tipo de servicio (Internet Dedicado, etc.)
6. ubicacion: Su dirección
7. contacto: Celular o E-mail

(Solo si es una Falla Técnica, pregunta opcionalmente):
8. tiempo: ¿Desde cuándo falla?
9. conexion: ¿WiFi o Cable?
10. reinicio: ¿Ya reinició equipos?

REGLAS DE ORO:
- NUNCA menciones que tienes una "base de conocimiento" o un archivo. Actúa natural.
- NO hagas todas las preguntas de golpe. Haz 1 o 2 máximo.
- Si ya dio un dato, no lo vuelvas a preguntar.

FINALIZACIÓN FORMATO JSON: Cuando tengas los datos mínimos, incluye EXACTAMENTE este JSON oculto al final:

\`\`\`ticket_data
{"tipo":"...","problema":"...","nombre":"...","dni":"...","servicio":"...","tiempo":"...","conexion":"...","reinicio":"...","ubicacion":"...","contacto":"..."}
\`\`\`
`.trim();

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, userText } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Formato de historial inválido' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'La API Key de Gemini no está configurada en el servidor (.env).' });
        }

        // Add SYSTEM_PROMPT to the model instructions
        const chatSession = model.startChat({
            systemInstruction: SYSTEM_PROMPT,
            history: messages.filter(m => m.role === 'user' || m.role === 'model'),
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000,
            }
        });

        const result = await chatSession.sendMessage(userText);
        const responseText = result.response.text();
        
        res.json({ text: responseText });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        
        // Handle specific Gemini quota errors via their generic codes if mapped
        if (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exhausted'))) {
            return res.status(429).json({ error: 'Quota exceeded', message: 'Servidor ocupado' });
        }
        if (error.message && error.message.includes('API key not valid')) {
            return res.status(400).json({ error: 'Invalid API Key', message: 'Key bloqueada o inválida' });
        }

        res.status(500).json({ error: 'Error interno del servidor de IA.' });
    }
});

// ==========================================
// TICKET STORAGE API
// ==========================================

// Leer tickets
app.get('/api/tickets', (req, res) => {
    try {
        const data = fs.readFileSync(ticketsPath, 'utf8');
        res.json(JSON.parse(data));
    } catch(e) {
        res.status(500).json({ error: 'Error al leer tickets' });
    }
});

// Crear nuevo ticket
app.post('/api/tickets', (req, res) => {
    try {
        const newTicket = req.body;
        const data = fs.readFileSync(ticketsPath, 'utf8');
        const tickets = JSON.parse(data);
        
        tickets.push(newTicket);
        fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
        
        res.status(201).json({ success: true, ticket: newTicket });
    } catch(e) {
        res.status(500).json({ error: 'Error al guardar el ticket' });
    }
});

// Actualizar estado de ticket
app.put('/api/tickets/:id', (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const { status } = req.body;
        
        const data = fs.readFileSync(ticketsPath, 'utf8');
        const tickets = JSON.parse(data);
        
        const index = tickets.findIndex(t => t.id === ticketId);
        if (index !== -1) {
            tickets[index].status = status;
            fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
            res.json({ success: true, ticket: tickets[index] });
        } else {
            res.status(404).json({ error: 'Ticket no encontrado' });
        }
    } catch(e) {
        res.status(500).json({ error: 'Error al actualizar el ticket' });
    }
});

app.listen(PORT, () => {
    console.log(`🤖 Backend IA corriendo en http://localhost:${PORT}`);
    console.log(`💬 Endpoint habilitado: http://localhost:${PORT}/api/chat`);
    console.log(`🎫 Base de datos de tickets activa en ${ticketsPath}`);
});
