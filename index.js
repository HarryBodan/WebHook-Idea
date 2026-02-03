const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch"); // node-fetch v2
const path = require("path");

const app = express();
app.use(bodyParser.json());

// Servir archivos estáticos para PDF
app.use(express.static(path.join(__dirname, "public")));

const VERIFY_TOKEN = "idea_chatbot_verify_2026";
const PAGE_ACCESS_TOKEN = "EAAXOFZBjxteABQtVoGB6fNJLOhZAH9JjoZAWBZBB5WiCe0dGpXjLwkV1qzAFtgb76B7zTBcaEBBclpKZBI6LbESPTa4duAZCvaMSKJ2WfK2oCQLAfilpfOHyLJwignxOGAxVt4jPWowqTxyFBJ1q53xq9E9JaOAqc8Il2A5Tf4Ke8zMXZAn1W0LhJTb770gSC9MGJZADAGLsgQZDZD";

// Mantener estado por usuario
const userStates = {};
const STATES = {
  NEW: "new",
  INTEREST_SELECTED: "interest_selected",
  CATALOG_SENT: "catalog_sent",
};

// Verificación de webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado!");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Recepción de mensajes y postbacks
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

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
function handleMessage(psid, message) {
  const text = message.text ? message.text.trim().toLowerCase() : "";
  let state = userStates[psid] || STATES.NEW;

  switch (state) {
    case STATES.NEW:
      sendWelcome(psid);
      userStates[psid] = STATES.NEW; // Seguimos en NEW hasta que haga click
      break;

    case STATES.INTEREST_SELECTED:
      sendTextMessage(psid, "Saludos, un asesor estará pronto con usted. 👌");
      break;

    case STATES.CATALOG_SENT:
      sendTextMessage(psid, "Saludos, un asesor estará pronto con usted. 👌");
      break;

    default:
      sendTextMessage(psid, "Saludos, un asesor estará pronto con usted. 👌");
  }
}

// Manejo de botones
function handlePostback(psid, postback) {
  const payload = postback.payload;

  if (
    payload === "INTERES_ACABADOS" ||
    payload === "INTERES_VENTANAS" ||
    payload === "INTERES_PUERTAS" ||
    payload === "HABLA_ASESOR"
  ) {
    sendTextMessage(psid, "¡Gracias! Un asesor se pondrá en contacto contigo en unos minutos.");
    sendCatalogButton(psid, "Mientras tanto, puedes ver nuestro catálogo:");
    userStates[psid] = STATES.INTEREST_SELECTED;
  } else if (payload === "VER_CATALOGO") {
    sendDocument(psid, "Catalogo Idea.pdf");
    userStates[psid] = STATES.CATALOG_SENT;
  } else {
    sendTextMessage(psid, "Disculpa, no entendí. Por favor usa los botones.");
  }
}

// Mensaje de bienvenida con botones iniciales
function sendWelcome(psid) {
  const message = `¡Hola! 👋 Gracias por contactarnos.  
Somos expertos en acabados arquitectónicos, ventanas y puertas de aluminio y vidrio, sistemas de vidrio templado, laminado, insulado, barandas y cielos rasos.  
¿En qué estás interesado?`;

  const buttons = [
    { type: "postback", title: "Acabados arquitectónicos", payload: "INTERES_ACABADOS" },
    { type: "postback", title: "Ventanas a medida", payload: "INTERES_VENTANAS" },
    { type: "postback", title: "Puertas a medida", payload: "INTERES_PUERTAS" },
    { type: "postback", title: "Habla con asesor", payload: "HABLA_ASESOR" },
  ];

  sendButtonTemplate(psid, message, buttons);
}

// Botón de catálogo
function sendCatalogButton(psid, text) {
  const buttons = [{ type: "postback", title: "Ver catálogo", payload: "VER_CATALOGO" }];
  sendButtonTemplate(psid, text, buttons);
}

// Enviar plantilla de botones
function sendButtonTemplate(psid, text, buttons) {
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "template",
        payload: { template_type: "button", text, buttons },
      },
    },
  };
  callSendAPI(body);
}

// Enviar mensaje simple
function sendTextMessage(psid, text) {
  const body = { recipient: { id: psid }, message: { text } };
  callSendAPI(body);
}

// Enviar PDF como documento
function sendDocument(psid, filename) {
  const url = `https://webhook-idea.onrender.com/${encodeURIComponent(filename)}`;
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "file",
        payload: { url },
      },
    },
  };
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
