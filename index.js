// index.js - Webhook Messenger listo para Render
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch"); // node-fetch v2, funciona con require

const app = express();
app.use(bodyParser.json());

// Tu token de verificación (elige uno seguro)
const VERIFY_TOKEN = "idea_chatbot_verify_2026";

// Tu Page Access Token (pon el que generes en Messenger)
const PAGE_ACCESS_TOKEN = "<TU_PAGE_ACCESS_TOKEN>";

// GET /webhook - Para que Facebook verifique tu webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado!");
    return res.status(200).send(challenge); // IMPORTANTE: solo challenge
  } else {
    res.sendStatus(403);
  }
});

// POST /webhook - Para recibir mensajes y postbacks
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      if (webhookEvent.message) {
        console.log(`Mensaje recibido de ${senderPsid}:`, webhookEvent.message.text);
        // Ejemplo: responder "Hola" automáticamente
        sendTextMessage(senderPsid, "¡Hola! Gracias por tu mensaje.");
      } else if (webhookEvent.postback) {
        console.log(`Postback de ${senderPsid}:`, webhookEvent.postback.payload);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Función para enviar mensaje de texto simple
function sendTextMessage(psid, text) {
  const body = {
    recipient: { id: psid },
    message: { text: text }
  };

  fetch(`https://graph.facebook.com/v24.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(json => console.log("Mensaje enviado:", json))
    .catch(err => console.error("Error enviando mensaje:", err));
}

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));