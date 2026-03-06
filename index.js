const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch"); // node-fetch v2
const path = require("path");

const app = express();
app.use(bodyParser.json());

// Servir archivos estáticos para PDF
app.use(express.static(path.join(__dirname, "public")));

const VERIFY_TOKEN = "idea_chatbot_verify_2026";
const PAGE_ACCESS_TOKEN = "EAAXOFZBjxteABipbNS2BmBtV6Y6WytuLZAn50Q1pqsMklPbi8rjrMnYjCGXZAspBOZBnFCyFnAPMw3X5YQMLii41ScyASj97Y6hQdEAofxMU2FSQ2atjdMiYZCt8YRfPI03hO7vnhS3uUiJy2afIqQ3mIGwDhnxXRgajcaeVSNT2eefvrgV4sCLwAta47WuqZAFeAuto6wZDZD";

// Estados del usuario
const VALUES = {
  ACABADOS: "INTERES_ACABADOS",
  VENTANAS: "INTERES_VENTANAS",
  PUERTAS: "INTERES_PUERTAS",
  ASESOR: "HABLA_ASESOR",
  VER_CATALOGO: "VER_CATALOGO"
};

const STATES = {
  START: "start",
  AWAITING_SELECTION: "awaiting_selection",
  AWAITING_CATALOG_DECISION: "awaiting_catalog_decision",
  HANDOVER: "handover",
};

// Almacenamiento en memoria: { [psid]: { state: string, lastInteraction: number, processing: boolean } }
const userSessions = {};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
      if (!entry.messaging || entry.messaging.length === 0) return;

      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      checkSession(senderPsid);

      if (webhookEvent.message) {
        if (webhookEvent.message.is_echo) return;
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

// Gestión de sesión
function checkSession(psid) {
  const now = Date.now();
  if (!userSessions[psid]) {
    userSessions[psid] = { state: STATES.START, lastInteraction: now, processing: false };
  } else {
    const diff = now - userSessions[psid].lastInteraction;
    if (diff > ONE_DAY_MS) {
      userSessions[psid] = { state: STATES.START, lastInteraction: now, processing: false };
    }
  }
}

function updateLastInteraction(psid) {
  if (userSessions[psid]) {
    userSessions[psid].lastInteraction = Date.now();
  }
}

// Manejo de mensajes de texto
function handleMessage(psid, message) {
  const session = userSessions[psid];

  // Silencio en HANDOVER
  if (session.state === STATES.HANDOVER) return;

  // Evitar duplicados si ya se está procesando una respuesta
  if (session.processing) {
    console.log(`Mensaje ignorado (procesando previo) para PSID: ${psid}`);
    return;
  }

  session.processing = true;
  updateLastInteraction(psid);

  if (session.state === STATES.AWAITING_SELECTION || session.state === STATES.START) {
    sendWelcome(psid).finally(() => { session.processing = false; });
  } else if (session.state === STATES.AWAITING_CATALOG_DECISION) {
    sendCatalogQuestion(psid, "Para continuar, por favor selecciona una opción:").finally(() => { session.processing = false; });
  } else {
    session.processing = false;
  }
}

// Manejo de botones (Postbacks)
function handlePostback(psid, postback) {
  const payload = postback.payload;
  const session = userSessions[psid];

  if (session.processing) return;
  session.processing = true;
  updateLastInteraction(psid);

  if ([VALUES.ACABADOS, VALUES.VENTANAS, VALUES.PUERTAS, VALUES.ASESOR].includes(payload)) {
    sendTextMessage(psid, "¡Gracias! En unos minutos estaremos respondiendo o un asesor te responderá para asesorarte. 👌").then(() => {
      setTimeout(() => {
        sendCatalogQuestion(psid, "¿Mientras tanto deseas ver nuestro catálogo?").finally(() => { session.processing = false; });
      }, 1500);
    });
    session.state = STATES.AWAITING_CATALOG_DECISION;

  } else if (payload === VALUES.VER_CATALOGO) {
    sendDocument(psid, "Catalogo Idea.pdf").finally(() => {
      session.processing = false;
      session.state = STATES.HANDOVER;
    });

  } else {
    sendWelcome(psid).finally(() => { session.processing = false; });
  }
}

// ----------------------------------------------------------------------------
// Funciones de Envío
// ----------------------------------------------------------------------------

async function sendWelcome(psid) {
  // 1. Mensaje de Bienvenida Inicial (Intro)
  const introMsg = `👋 Bienvenido a IDEA Nicaragua.

🏢 Especialistas en soluciones en aluminio y vidrio para proyectos residenciales y comerciales.
Indíquenos qué tipo de proyecto desea desarrollar y con gusto le brindaremos asesoría personalizada.

📥 Puede consultar nuestro catálogo en el siguiente enlace:
https://oneplustechnologys.com/Idea/Catalogo-Idea.pdf`;

  // 2. Mensaje de Descripción de servicios
  const servicesMsg = "Gracias por ponerse en contacto con nosotros.\n\nSomos una empresa dedicada a la fabricación e instalación de acabados arquitectónicos, ventanas y puertas de aluminio y vidrio, sistemas de vidrio templado, laminado, insulado, barandas y cielo raso.";

  try {
    // Enviamos primero el intro
    await sendTextMessageAsync(psid, introMsg);
    // Luego el servicios
    await sendTextMessageAsync(psid, servicesMsg);

    // Finalmente el carrusel
    const carouselPayload = {
      template_type: "generic",
      elements: [
        {
          title: "¿En qué está interesado?",
          subtitle: "Selecciona una categoría",
          buttons: [
            { type: "postback", title: "Acabados Arq.", payload: VALUES.ACABADOS },
            { type: "postback", title: "Ventanas a medida", payload: VALUES.VENTANAS },
            { type: "postback", title: "Puertas a medida", payload: VALUES.PUERTAS }
          ]
        },
        {
          title: "Asesoría Personalizada",
          subtitle: "¿Prefieres hablar con un experto?",
          buttons: [
            { type: "postback", title: "Habla con asesor", payload: VALUES.ASESOR }
          ]
        }
      ]
    };

    const bodyCarousel = {
      recipient: { id: psid },
      message: { attachment: { type: "template", payload: carouselPayload } }
    };

    await callSendAPI(bodyCarousel);
    userSessions[psid].state = STATES.AWAITING_SELECTION;
  } catch (err) {
    console.error("Error en sendWelcome:", err);
  }
}

function sendCatalogQuestion(psid, textPrefix) {
  const buttons = [{ type: "postback", title: "Ver catálogo", payload: VALUES.VER_CATALOGO }];
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "template",
        payload: { template_type: "button", text: textPrefix, buttons }
      }
    }
  };
  return callSendAPI(body);
}

function sendTextMessage(psid, text) {
  const body = { recipient: { id: psid }, message: { text } };
  return callSendAPI(body);
}

function sendTextMessageAsync(psid, text) {
  return sendTextMessage(psid, text);
}

function sendDocument(psid, filename) {
  const domain = "https://webhook-idea.onrender.com";
  const url = `${domain}/${encodeURIComponent(filename)}`;
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "file",
        payload: { url }
      }
    }
  };
  return callSendAPI(body);
}

function callSendAPI(body) {
  return fetch(`https://graph.facebook.com/v24.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(res => res.json())
    .then(json => {
      if (json.error) {
        console.error("Error de Facebook:", json.error);
        throw json.error;
      }
      console.log("Mensaje enviado exitosamente.");
      return json;
    })
    .catch(err => {
      console.error("Error enviando mensaje:", err);
      throw err;
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));
