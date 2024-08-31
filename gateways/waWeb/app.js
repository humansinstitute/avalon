const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios'); // You'll need to install this: npm install axios
const { v4: uuidv4 } = require('uuid');

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
});

// When the client receives a QR code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

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

        await message.reply(response.message)

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
    // Check if the message is from the bot itself
    if (message.fromMe) {
        console.log('Ignoring message from self:\n', message.body);
        return; // Exit the function early if the message is from the bot
    }

    // Check if the message contains a command (starts with $)

    console.log('Received message:', message.body);
    // Handle specific commands
    if (message.body === '$ping') {
        await message.reply('pong');
    } else if (message.body.includes('$balance')) {
        // Implement balance command
        await message.reply(`Your balance is ${balanceAmount} sats.`);
    } else if (message.body.includes('$nostr')) {
        // Implement balance command
        await message.reply(`Today on Nostr, from your friends Lyn is going off with a great rant, do you want to know more (1). Alex has a great artcile on why nostr is powerful (2). Farida is talking about the evils of the CFA (3)...`);
    } else if (message.body.includes('$publish')) {
        // Implement balance command
        await message.reply(`I have published to nostr (npub238hkj...) Live from Lome! Getting ready for Kisaw round 2. Zap to show your support`);
    } else if (message.body.includes('$pay')) {
        // Implement pay command
        await message.reply('This will send Alex (gladstein@nostrplebs.com) 5,000 sats.\n\nConfirm with pin...');
        balanceAmount = balanceAmount - 5000;
        // Add a 10-second delay here
        await new Promise(resolve => setTimeout(resolve, 6000));
        // Carry on with program
        await message.reply(`5,000 sats sent to Alex (gladstein@nostrplebs.com). \n\nYour new balance is: ${balanceAmount} sats`);
    } else if (message.body.includes('sausage')) {
        // Implement pay command
        await message.reply('This will send Alex (gladstein@nostrplebs.com) 5,000 sats.\n\nConfirm with pin...');
        balanceAmount = balanceAmount - 5000;
        // Add a 10-second delay here
        await new Promise(resolve => setTimeout(resolve, 6000));
        // Carry on with program
        await message.reply(`5,000 sats sent to Alex (gladstein@nostrplebs.com). \n\nYour new balance is: ${balanceAmount} sats`);
    } else {
        // If no command is detected, call the research function
        await researchAnswer(message);
    }
});

// Add error event listener
client.on('auth_failure', msg => {
    console.error('Authentication failure:', msg);
});

// Start the client
client.initialize();