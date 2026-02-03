const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch"); // node-fetch v2

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "idea_chatbot_verify_2026";
const PAGE_ACCESS_TOKEN = "EAAXOFZBjxteABQtVoGB6fNJLOhZAH9JjoZAWBZBB5WiCe0dGpXjLwkV1qzAFtgb76B7zTBcaEBBclpKZBI6LbESPTa4duAZCvaMSKJ2WfK2oCQLAfilpfOHyLJwignxOGAxVt4jPWowqTxyFBJ1q53xq9E9JaOAqc8Il2A5Tf4Ke8zMXZAn1W0LhJTb770gSC9MGJZADAGLsgQZDZD";

// Guardamos quienes ya hicieron el flujo completo (solo en memoria)
const completedUsers = new Set();

// GET /webhook - Verificación
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado!");
    return res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST /webhook - Recepción de mensajes
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      if (completedUsers.has(senderPsid)) {
        // Usuario ya completó flujo → solo mensaje profesional
        sendTextMessage(senderPsid, "¡Saludos! Un asesor se pondrá en contacto contigo en breve. Muchas gracias por tu interés.");
      } else {
        // Usuario nuevo o que no terminó el flujo
        if (webhookEvent.message) {
          sendWelcome(senderPsid);
        } else if (webhookEvent.postback) {
          handlePostback(senderPsid, webhookEvent.postback);
        }
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Enviar mensaje de bienvenida + botones de interés
function sendWelcome(psid) {
  const message = `¡Hola! 👋 Gracias por contactarnos.
Somos expertos en la fabricación e instalación de acabados arquitectónicos, ventanas y puertas de aluminio y vidrio, sistemas de vidrio templado, laminado, insulado, barandas y cielos rasos.
Por favor, selecciona en qué estás interesado:`;
  sendInterestButtons(psid, message);
}

// Botones de interés
function sendInterestButtons(psid, text) {
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons: [
            { type: "postback", title: "Acabados arquitectónicos", payload: "INTERES_ACABADOS" },
            { type: "postback", title: "Ventanas a medida", payload: "INTERES_VENTANAS" },
            { type: "postback", title: "Puertas a medida", payload: "INTERES_PUERTAS" },
            { type: "postback", title: "Habla con asesor", payload: "INTERES_ASESOR" }
          ],
        },
      },
    },
  };
  callSendAPI(body);
}

// Botón de catálogo
function sendCatalogButton(psid) {
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: "https://webhook-idea.onrender.com/Catalogo%20Idea.pdf" // PDF en la raíz de Render
        },
      },
    },
  };
  callSendAPI(body);
}

// Manejo de postbacks
function handlePostback(psid, postback) {
  const payload = postback.payload;

  if (["INTERES_ACABADOS","INTERES_VENTANAS","INTERES_PUERTAS","INTERES_ASESOR"].includes(payload)) {
    sendTextMessage(psid, "¡Gracias! Un asesor se pondrá en contacto contigo en breve.");
    sendCatalogButton(psid); // Envía PDF
    completedUsers.add(psid); // Marca como completado
  } else {
    sendTextMessage(psid, "Disculpa, no entendí. Por favor usa los botones.");
  }
}

// Mensaje simple
function sendTextMessage(psid, text) {
  const body = { recipient: { id: psid }, message: { text } };
  callSendAPI(body);
}

// Llamada a Graph API
function callSendAPI(body) {
  fetch(`https://graph.facebook.com/v24.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(res => res.json())
    .then(json => console.log("Mensaje enviado:", json))
    .catch(err => console.error("Error enviando mensaje:", err));
}

// Servir PDF desde la raíz
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));