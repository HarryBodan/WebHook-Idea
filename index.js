const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch"); // node-fetch v2

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "idea_chatbot_verify_2026";
const PAGE_ACCESS_TOKEN = "EAAXOFZBjxteABQtVoGB6fNJLOhZAH9JjoZAWBZBB5WiCe0dGpXjLwkV1qzAFtgb76B7zTBcaEBBclpKZBI6LbESPTa4duAZCvaMSKJ2WfK2oCQLAfilpfOHyLJwignxOGAxVt4jPWowqTxyFBJ1q53xq9E9JaOAqc8Il2A5Tf4Ke8zMXZAn1W0LhJTb770gSC9MGJZADAGLsgQZDZD";

// Estado de cada usuario { psid: { state, blockedUntil } }
const userStates = {};

// Estados posibles
const STATES = {
  FIRST_MESSAGE: "first_message",
  ASK_INTEREST: "ask_interest",
  BUTTON_CLICKED: "button_clicked",
  BOT_DONE: "bot_done",
};

// Tiempo de bloqueo en ms (24 horas)
const BLOCK_TIME = 24 * 60 * 60 * 1000;

// GET /webhook - verificación
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

// POST /webhook - mensajes y postbacks
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      // Verificar bloqueo de 24 horas
      const user = userStates[senderPsid];
      if (user && user.blockedUntil && Date.now() < user.blockedUntil) {
        return; // no hacer nada, bot bloqueado
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

// Manejo de mensajes
function handleMessage(psid, receivedMessage) {
  const text = receivedMessage.text ? receivedMessage.text.trim().toLowerCase() : "";

  let state = (userStates[psid] && userStates[psid].state) || STATES.FIRST_MESSAGE;

  switch (state) {
    case STATES.FIRST_MESSAGE:
      sendWelcome(psid);
      userStates[psid] = { state: STATES.ASK_INTEREST };
      break;

    case STATES.ASK_INTEREST:
      // Si escribe texto en vez de click, repetir botones
      sendInterestButtons(psid, "Por favor selecciona una opción usando los botones:");
      break;

    case STATES.BUTTON_CLICKED:
      // Recordatorio único
      sendTextMessage(psid, "Nuestro asesor estará contigo pronto 🙂. Por favor, espera un momento.");
      // Bloqueamos el bot por 24 horas
      userStates[psid].blockedUntil = Date.now() + BLOCK_TIME;
      userStates[psid].state = STATES.BOT_DONE;
      break;

    default:
      sendTextMessage(psid, "Disculpa, no entendí. Por favor usa los botones.");
  }
}

// Manejo de postbacks
function handlePostback(psid, postback) {
  const payload = postback.payload;

  if (
    payload === "INTERES_ACABADOS" ||
    payload === "INTERES_VENTANAS" ||
    payload === "INTERES_PUERTAS"
  ) {
    sendTextMessage(psid, "¡Gracias! Un asesor se pondrá en contacto contigo en unos minutos 🙂");
    sendCatalogButton(psid, "Mientras tanto, puedes ver nuestro catálogo:");
    userStates[psid] = { state: STATES.BUTTON_CLICKED };
  } else if (payload === "HABLA_CON_ASESOR") {
    sendTextMessage(psid, "Un asesor se pondrá en contacto contigo en breve 🙂");
    userStates[psid] = { state: STATES.BOT_DONE, blockedUntil: Date.now() + BLOCK_TIME };
  } else if (payload === "VER_CATALOGO") {
    sendTextMessage(psid, "Aquí tienes nuestro catálogo: [LINK_O_PDF]");
    userStates[psid] = { state: STATES.BOT_DONE, blockedUntil: Date.now() + BLOCK_TIME };
  } else {
    sendTextMessage(psid, "Disculpa, no entendí. Por favor usa los botones.");
  }
}

// Mensaje de bienvenida
function sendWelcome(psid) {
  const message = `¡Hola! 👋 Gracias por ponerte en contacto con nosotros.
Somos expertos en fabricación e instalación de acabados arquitectónicos, ventanas y puertas de aluminio y vidrio, sistemas de vidrio templado, laminado, insulado, barandas y cielos rasos.
¿En qué estás interesado?`;
  sendInterestButtons(psid, message);
}

// Botones de interés (ahora 4)
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
            { type: "postback", title: "Habla con asesor", payload: "HABLA_CON_ASESOR" },
          ],
        },
      },
    },
  };
  callSendAPI(body);
}

// Botón catálogo
function sendCatalogButton(psid, text) {
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons: [{ type: "postback", title: "Ver catálogo", payload: "VER_CATALOGO" }],
        },
      },
    },
  };
  callSendAPI(body);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));
