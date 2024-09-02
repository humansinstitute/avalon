const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios'); // You'll need to install this: npm install axios
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose'); // Add this line

// Assuming you have these functions defined elsewhere
const callOSAPI = require('../../services/chat/callOSAPI');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Client is ready!');
    checkAndLogBudget(); // Call the function to check and log the budget
});

// When the client receives a QR code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// MongoDB connection
mongoose.connect(process.env.PRODMONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Billing model
const billingSchema = new mongoose.Schema({
    app: { type: String, required: true },
    budget: { type: Number, required: true }
});

const Budgets = mongoose.model('Budgets', billingSchema);

// Logging model
const loggingSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    input: Object,
    output: Object
});

const Logging = mongoose.model('Logging', loggingSchema);

// Function to research and answer questions
async function researchAnswer(message) {
    try {
        // Send an initial response
        // await client.sendMessage(message.from, 'Ok - doing some research 🤔📖');

        // Remove any potential command strings from the question
        const question = message.body;
        const pipeData = { question, action: "research" };
        const payload = {
            pipelineData: {
                runID: uuidv4(),
                payload: pipeData,
            },
            origin: {
                originID: message._data.id._serialized,
                conversationID: message._data.id._serialized,
                channel: "whatsApp",
                userID: message.from,
                billingID: message.from, // Represents the billing identity - currently slack team will be abstracted
            }
        };

        const response = await callOSAPI("execute", payload);

        // Log the interaction
        await Logging.create({
            input: message,
            output: response
        });

        await message.reply(response.message);

        // Update the budget (assuming 1 cent per interaction)
        await Budgets.findOneAndUpdate(
            { app: 'avalon' },
            { $inc: { budget: -0.05 } },
            { new: true, upsert: true }
        );

        return true;
    } catch (error) {
        console.error('Error in researchAnswer:', error);
        await client.sendMessage(message.from, 'Sorry, there was an error processing your request.');
        return false;
    }
}

// Listen for incoming messages
client.on('message_create', async (message) => {
    let balanceAmount = 100000;
    // Check the current budget amount on initialization
    let currentBudget;

    // Check if the message is from the bot itself
    if (message.fromMe) {
        console.log('Ignoring message from self:\n', message.body);
        return; // Exit the function early if the message is from the bot
    }

    console.log('Received message:', message.body);
    // Handle specific commands
    // if (message.body === '$ping') {
    //     await message.reply('pong');
    // } else { }
    try {
        const billingDoc = await Budgets.findOne({ app: 'avalon' });
        console.log(billingDoc);
        if (!billingDoc || billingDoc.budget < 0.1) {
            await message.reply("This app is out of budget, please contact Pete!");
        } else {
            await researchAnswer(message);

            // Deprecate the budget by 5 cents
            billingDoc.budget -= 0.05;
            await billingDoc.save();
        }
    } catch (error) {
        console.error('Error checking budget or updating billing:', error);
        await message.reply('Sorry, there was an error processing your request.');
    }

});

// Add error event listener
client.on('auth_failure', msg => {
    console.error('Authentication failure:', msg);
});

// Start the client
client.initialize();

// Add this function after the Budgets model definition
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