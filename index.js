const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch"); // node-fetch v2
const path = require("path");
const app = express();

app.use(bodyParser.json());
app.use(express.static("public")); // Para servir PDF

const VERIFY_TOKEN = "idea_chatbot_verify_2026";
const PAGE_ACCESS_TOKEN = "EAAXOFZBjxteABQtVoGB6fNJLOhZAH9JjoZAWBZBB5WiCe0dGpXjLwkV1qzAFtgb76B7zTBcaEBBclpKZBI6LbESPTa4duAZCvaMSKJ2WfK2oCQLAfilpfOHyLJwignxOGAxVt4jPWowqTxyFBJ1q53xq9E9JaOAqc8Il2A5Tf4Ke8zMXZAn1W0LhJTb770gSC9MGJZADAGLsgQZDZD";

// Trackear usuarios que ya interactuaron
const interactedUsers = {};

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

      if (interactedUsers[senderPsid]) {
        // Ya interactuó antes
        sendTextMessage(senderPsid, "Saludos, un asesor estará pronto con usted.");
        return;
      }

      if (webhookEvent.message) {
        handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handlePostback(senderPsid, webhookEvent.postback);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Manejo de mensajes de texto
function handleMessage(psid, receivedMessage) {
  sendWelcome(psid);
  interactedUsers[psid] = true;
}

// Manejo de postbacks
function handlePostback(psid, postback) {
  const payload = postback.payload;

  if (payload === "INTERES_ACABADOS" || payload === "INTERES_VENTANAS" || payload === "INTERES_PUERTAS") {
    sendTextMessage(psid, "¡Gracias! Un asesor se pondrá en contacto contigo en unos minutos.");
    sendCatalogButton(psid, "Mientras tanto, puedes ver nuestro catálogo:");
  } else if (payload === "HABLAR_ASESOR") {
    sendTextMessage(psid, "Un asesor estará pronto contigo.");
  } else if (payload === "VER_CATALOGO") {
    sendCatalog(psid);
  } else {
    sendTextMessage(psid, "Disculpa, no entendí. Por favor usa los botones.");
  }
}

// Mensaje de bienvenida con botones iniciales
function sendWelcome(psid) {
  const message = `¡Hola! 👋 Gracias por ponerte en contacto con nosotros. 
Somos expertos en acabados arquitectónicos, ventanas y puertas de aluminio y vidrio, sistemas de vidrio templado, laminado, insulado, barandas y cielos rasos.
Por favor, selecciona una opción para continuar:`;
  sendOptionsButtons(psid, message);
}

// Botones iniciales
function sendOptionsButtons(psid, text) {
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
            { type: "postback", title: "Hablar con asesor", payload: "HABLAR_ASESOR" },
          ],
        },
      },
    },
  };
  callSendAPI(body);
}

// Botón de catálogo
function sendCatalogButton(psid, text) {
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons: [
            { type: "postback", title: "Ver catálogo", payload: "VER_CATALOGO" },
          ],
        },
      },
    },
  };
  callSendAPI(body);
}

// Enviar PDF de catálogo
function sendCatalog(psid) {
  const pdfUrl = "https://webhook-idea.onrender.com/Catalogo%20Idea.pdf"; // Asegúrate de que el PDF esté en /public
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: pdfUrl,
          is_reusable: true,
        },
      },
    },
  };
  callSendAPI(body);
}

// Enviar mensaje de texto
function sendTextMessage(psid, text) {
  const body = { recipient: { id: psid }, message: { text: text } };
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));
