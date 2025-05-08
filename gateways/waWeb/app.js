/**
 * gateways/waWeb/app.js
 *
 * Gateway connecting WhatsApp Web to the OSAPI backend.
 * - Handles authentication via QR code and LocalAuth strategy.
 * - Processes incoming messages by calling `callOSAPI`.
 * - Logs interactions and tracks budget usage in MongoDB.
 */

// External dependencies
// Library for interacting with WhatsApp Web and managing sessions.
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
// Displays QR code in the terminal for user authentication.
import qrcode from 'qrcode-terminal';
// HTTP client for API requests (used within callOSAPI).
import axios from 'axios';
// Generates UUIDs for unique run identifiers.
import { v4 as uuidv4 } from 'uuid';
// ODM for MongoDB database interactions.
import mongoose from 'mongoose';

// Local service module for calling the OSAPI backend.
import callOSAPI from '../../services/chat/callOSAPI.js';

// Initialize WhatsApp client with LocalAuth persistence.
// Puppeteer args ensure compatibility in sandboxed environments.
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Display QR code in terminal when WhatsApp Web requests authentication.
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Once the client is ready, log confirmation and check current budget.
client.once('ready', () => {
    console.log('Client is ready!');
    checkAndLogBudget();
});

// Handle authentication failures by logging the error.
client.on('auth_failure', msg => {
    console.error('Authentication failure:', msg);
});

// MongoDB connection setup.
// Connects to the database using the URI from the environment variable.
// Uses new URL parser and unified topology for compatibility.
mongoose.connect(process.env.PRODMONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define the billing schema and model to track application budget.
const billingSchema = new mongoose.Schema({
    app: { type: String, required: true },
    budget: { type: Number, required: true }
});
const Budgets = mongoose.model('Budgets', billingSchema);

// Define the logging schema and model to store interaction logs.
const loggingSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    input: Object,
    output: Object
});
const Logging = mongoose.model('Logging', loggingSchema);

/**
 * Fetches and logs the current budget for the 'avalon' application.
 *
 * @returns {Promise<void>}
 */
async function checkAndLogBudget() {
    try {
        const budgetDoc = await Budgets.findOne({ app: 'avalon' });
        if (budgetDoc) {
            console.log(`Current budget for Avalon: $${budgetDoc.budget.toFixed(2)}`);
        } else {
            console.log('No budget document found for Avalon');
        }
    } catch (error) {
        console.error('Error fetching budget:', error);
    }
}

/**
 * Processes an incoming WhatsApp message by calling the OSAPI service.
 * Logs the request and response, replies to the user, and updates the budget.
 *
 * @param {import('whatsapp-web.js').Message} message - The incoming WhatsApp message object.
 * @returns {Promise<boolean>} - True on success, false on error.
 */
async function researchAnswer(message) {
    try {
        // Extract the user's question from the message body.
        const question = message.body;
        // Prepare pipeline data with a unique run ID.
        const pipeData = { question, action: "research" };
        const payload = {
            pipelineData: {
                runID: uuidv4(),
                payload: pipeData,
            },
            origin: {
                // Metadata for tracing and billing.
                originID: message._data.id._serialized,
                conversationID: message._data.id._serialized,
                channel: "whatsApp",
                userID: message.from,
                billingID: message.from,
            }
        };

        // Call the external OSAPI service.
        const response = await callOSAPI("execute", payload);

        // Store the request and response in the logging collection.
        await Logging.create({
            input: message,
            output: response
        });

        // Reply to the user with the service response.
        const sentMessage = await message.reply(response.message);
        //console.log(sentMessage);

        // Deduct 5 cents from the budget for this interaction.
        await Budgets.findOneAndUpdate(
            { app: 'avalon' },
            { $inc: { budget: -0.05 } },
            { new: true, upsert: true }
        );

        return true;
    } catch (error) {
        console.error('Error in researchAnswer:', error);
        // Inform the user of the error.
        await client.sendMessage(message.from, 'Sorry, there was an error processing your request.');
        return false;
    }
}

/**
 * Listener for incoming WhatsApp messages.
 * - Ignores messages sent by this client.
 * - Checks budget and processes messages if sufficient funds remain.
 */
client.on('message_create', async (message) => {
    // Ignore messages sent by the bot itself.
    if (message.fromMe) {
        console.log('Ignoring message from self:', message.body);
        return;
    }

    // Lookup gate details for this user
    const gateId = message.from;
    try {
        const gateRes = await axios.get(`http://localhost:3000/id/gate/${gateId}`);
        console.log('Gate User Details:', gateRes.data);
    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.log(`No identity found for ${gateId}, proceeding with default behavior`);
            await client.sendMessage(message.from, "Hi I'm curently running an Avalon AI and I don't recognise your user ID!");
            return;
        } else {
            console.error('Error fetching gate details:', err);
            return;
        }
    }

    console.log('Received message:', message.body);
    //console.log(message);

    try {
        // Retrieve current budget for Avalon.
        const billingDoc = await Budgets.findOne({ app: 'avalon' });
        // If budget is insufficient, notify the user.
        if (!billingDoc || billingDoc.budget < 0.10) {
            await message.reply("This app is out of budget, please contact Pete!");
        } else {
            // Process the message through researchAnswer.
            await researchAnswer(message);
            // Additional budget decrement for researchAnswer.
            billingDoc.budget -= 0.05;
            await billingDoc.save();
        }
    } catch (error) {
        console.error('Error checking budget or updating billing:', error);
        // Inform the user of any processing errors.
        await message.reply('Sorry, there was an error processing your request.');
    }
});

// Start the WhatsApp client connection process.
client.initialize();
