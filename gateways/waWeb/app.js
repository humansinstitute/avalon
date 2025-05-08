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
import aiWrapper from '../../services/chat/aiWrapper.js';
import gateKeeper from '../../services/agents/gateKeeper.js';
import extractPost from '../../services/agents/extractPost.js';

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
 * @param {string} npub - The user's npub identifier from gate details.
 * @returns {Promise<boolean>} - True on success, false on error.
 */
async function researchAnswer(message, npub) {
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
                userID: npub,
                billingID: npub,
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
    let npub = null; // Default to null if not found
    try {
        const gateRes = await axios.get(`http://localhost:3000/id/gate/${gateId}`);
        console.log('Gate User Details:', gateRes.data);
        npub = gateRes.data.npub;
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

    const callGateKeeper = await gateKeeper(message.body, "", npub);

    // Set agent call origin details
    callGateKeeper.origin.conversationID = message.id;

    // Call Groq for intent classification. 
    const intentObject = await aiWrapper(callGateKeeper);

    console.log("\n\n***** THE INTENT OBJECT *****\n\n");
    console.log(intentObject);

    try {
        // Retrieve current budget for Avalon.
        const billingDoc = await Budgets.findOne({ app: 'avalon' });
        // If budget is insufficient, notify the user.
        if (!billingDoc || billingDoc.budget < 0.10) {
            await message.reply("This app is out of budget, please contact Pete!");
        } else {

            // TODO HERE: TAKE SPECIFIC ACTIONS BASED OFF INTENT

            switch (intentObject.message.intent) {
                case 'research':
                case 'event':
                    // Process the message through researchAnswer with npub.
                    // If npub is null, fall back to message.from
                    await researchAnswer(message, npub || message.from);
                    // Additional budget decrement for researchAnswer.
                    billingDoc.budget -= 0.05;
                    await billingDoc.save();
                    break;
                case 'conversation':
                    await message.reply(intentObject.message.quickResponse);
                    // No additional budget decrement or save needed here for this specific action path
                    break;
                case 'post':
                    try {
                        // Extract the message to post to nostr    
                        const callExtractPost = await extractPost(message.body, "", npub);
                        // Set agent call origin details
                        callExtractPost.origin.conversationID = message.id;
                        // Call Groq for intent classification. 
                        const NostrPost = await aiWrapper(callExtractPost);
                        const thePost = NostrPost.message.post;

                        // Validate post content
                        if (!thePost || typeof thePost !== 'string' || thePost.trim() === '') {
                            console.log("No valid post content extracted or post is empty.");
                            await client.sendMessage(message.from, "I couldn't figure out what you want to post, or the message was empty.");
                            break;
                        }

                        // Submit post to Nostr
                        const nostrPostUrl = 'http://localhost:3000/post/note';
                        const postData = {
                            npub: npub,
                            content: thePost,
                            powBits: 20,
                            timeoutMs: 10000
                        };

                        console.log(`Attempting to post to Nostr for npub ${npub}:`, JSON.stringify(postData));
                        const nostrApiResponse = await axios.post(nostrPostUrl, postData, {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        console.log('Successfully posted to Nostr. API Response:', nostrApiResponse.data);
                        await message.reply(`Posted to nostr ${thePost}`);

                    } catch (err) {
                        console.error('Error in "post" intent processing:', err.response ? err.response.data : err.message);
                        await client.sendMessage(message.from, `Sorry, I wasn't able to send your note to Nostr. Please try again later.`);
                    }
                    break;

                default:
                    // Fallback for unhandled intents: respond with quickResponse
                    console.log(`Unhandled intent: ${intentObject.message.intent}. Responding with quickResponse.`);
                    if (intentObject.message.quickResponse) {
                        await message.reply(intentObject.message.quickResponse);
                    } else {
                        // Fallback if quickResponse is also missing for some reason
                        await message.reply("I'm not sure how to handle that request right now.");
                        console.log("Warning: quickResponse was also undefined for unhandled intent.");
                    }
                    break;
            }
        }
    } catch (error) {
        console.error('Error checking budget or updating billing:', error);
        // Inform the user of any processing errors.
        await message.reply('Sorry, there was an error processing your request.');
    }
});

// Start the WhatsApp client connection process.
client.initialize();
