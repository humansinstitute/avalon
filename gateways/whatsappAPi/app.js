const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Handle incoming messages
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        const entry = body.entry[0];
        const changes = entry.changes[0];
        const value = changes.value;

        if (value.messages && value.messages[0]) {
            const phone_number_id = value.metadata.phone_number_id;
            const from = value.messages[0].from;
            const msg_body = value.messages[0].text.body;

            console.log('Received message:', msg_body);

            // Process the message and get a response
            const response = processMessage(msg_body);

            // Send the response back to the user
            sendMessage(phone_number_id, from, response);
        }
    }

    res.sendStatus(200);
});

// Function to process incoming messages
function processMessage(message) {
    // Simple echo bot for demonstration
    return `You said: "${message}". This is a demo bot.`;
}

// Function to send messages
async function sendMessage(phone_number_id, to, message) {
    const url = `https://graph.facebook.com/v12.0/${phone_number_id}/messages`;
    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
    };

    try {
        await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

app.listen(port, () => {
    console.log(`Webhook is listening on port ${port}`);
});