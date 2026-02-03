// index.js - Webhook Messenger con PDF
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch"); // node-fetch v2

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "idea_chatbot_verify_2026";
const PAGE_ACCESS_TOKEN = "EAAXOFZBjxteABQtVoGB6fNJLOhZAH9JjoZAWBZBB5WiCe0dGpXjLwkV1qzAFtgb76B7zTBcaEBBclpKZBI6LbESPTa4duAZCvaMSKJ2WfK2oCQLAfilpfOHyLJwignxOGAxVt4jPWowqTxyFBJ1q53xq9E9JaOAqc8Il2A5Tf4Ke8zMXZAn1W0LhJTb770gSC9MGJZADAGLsgQZDZD";

// Para trackear estado de cada usuario
const userStates = {};

// Estados posibles
const STATES = {
  FIRST_MESSAGE: "first_message",
  ASK_INTEREST: "ask_interest",
  THANK_YOU: "thank_you",
};

// GET /webhook - Verificación de Facebook
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

// POST /webhook - Recepción de mensajes y postbacks
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
function handleMessage(psid, receivedMessage) {
  const text = receivedMessage.text ? receivedMessage.text.trim().toLowerCase() : "";

  // Estado del usuario
  let state = userStates[psid] || STATES.FIRST_MESSAGE;

  switch (state) {
    case STATES.FIRST_MESSAGE:
      sendWelcome(psid);
      userStates[psid] = STATES.ASK_INTEREST;
      break;

    case STATES.ASK_INTEREST:
      // Si escribe texto en vez de click, repetir los botones
      sendInterestButtons(psid, "Por favor selecciona una opción haciendo clic en uno de los botones:");
      break;

    case STATES.THANK_YOU:
      // Solo recordar que el asesor estará pronto
      sendTextMessage(psid, "Un asesor se pondrá en contacto contigo en unos minutos. Mientras tanto, puedes revisar nuestro catálogo.");
      break;

    default:
      sendTextMessage(psid, "Disculpa, no entendí. Por favor usa los botones.");
  }
}

// Manejo de postbacks (clic en botones)
function handlePostback(psid, postback) {
  const payload = postback.payload;

  if (
    payload === "INTERES_ACABADOS" ||
    payload === "INTERES_VENTANAS" ||
    payload === "INTERES_PUERTAS"
  ) {
    sendTextMessage(psid, "¡Gracias! Un asesor se pondrá en contacto contigo en unos minutos.");
    sendCatalogAndAsesorButton(psid, "Mientras tanto, puedes ver nuestro catálogo o hablar con un asesor:");
    userStates[psid] = STATES.THANK_YOU;
  } else if (payload === "VER_CATALOGO") {
    sendPdfCatalog(psid);
  } else if (payload === "HABLAR_ASESOR") {
    sendTextMessage(psid, "¡Perfecto! Un asesor se pondrá en contacto contigo en breve.");
  } else {
    sendTextMessage(psid, "Disculpa, no entendí. Por favor usa los botones.");
  }
}

// Mensaje de bienvenida
function sendWelcome(psid) {
  const message = `¡Hola! 👋 Gracias por ponerte en contacto con nosotros. 
Somos una empresa especializada en la fabricación e instalación de acabados arquitectónicos, ventanas y puertas de aluminio y vidrio, sistemas de vidrio templado, laminado, insulado, barandas y cielos rasos.  
¿En qué estás interesado?`;
  sendInterestButtons(psid, message);
}

// Botones de selección de interés
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
            { type: "postback", title: "Habla con asesor", payload: "HABLAR_ASESOR" }
          ],
        },
      },
    },
  };
  callSendAPI(body);
}

// Botón de catálogo + asesor
function sendCatalogAndAsesorButton(psid, text) {
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
            { type: "postback", title: "Habla con asesor", payload: "HABLAR_ASESOR" }
          ],
        },
      },
    },
  };
  callSendAPI(body);
}

// Enviar PDF
function sendPdfCatalog(psid) {
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: "https://webhook-idea.onrender.com/Catalogo%20Idea.pdf",
          is_reusable: true
        }
      }
    }
  };
  callSendAPI(body);
}

// Mensaje simple
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

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));

// Servir PDF estático
app.use(express.static(__dirname));