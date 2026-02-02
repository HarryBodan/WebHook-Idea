const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "idea_chatbot_verify_2026";
const PAGE_ACCESS_TOKEN = "<TU_PAGE_ACCESS_TOKEN>"; // lo pondrás después

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

app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      if (webhookEvent.message) {
        console.log(`Mensaje de ${senderPsid}:`, webhookEvent.message.text);
      } else if (webhookEvent.postback) {
        console.log(`Postback de ${senderPsid}:`, webhookEvent.postback.payload);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));
