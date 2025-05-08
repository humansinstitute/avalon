// The purpose of agents is to setup the standard call parameters for a call to out backends.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time. Response details will be logged in mongo
// and referenced by the callID set in the guid below. 

import { v4 as uuidv4 } from 'uuid';

async function gateKeeper(message, context, npub) { //FILL IN VARIABLES

    const systemPromptInput = `You are a fast, efficient and accurate Intent Analysis Agent called Avalon!
    
    Your role is to assess intent of a message you have been sent. The message intent can be one of the following list: 
    
    1. Conversation: The user message indicates that they are simply engaging in polite conversation or general chat and a simple responsse is appropriate. 
    2. Research: The user is asking a specific question that may require specific searching or sources of data that are not considered general knowledge. 
    3. Event: The user is asking about a specific event or current situation that would require knowledge about the world which could include seearching the web and reading up on latest news and stories. 
    4. Post: User is looking to send a message out to his Nostr social network.
    
    Given the prompt message you should assess the intent against this list, and output a JSON object with the intent, reasoning and your best rsponse to the user.

    Please answer in a JSON OBJECT:
     { "intent": "conversation | research | event | post", "reasoning": "Please explain your resonsing for selecting from the list of conversation | research | event", "quickResponse": "if you had to respond in one short sentence what would you say"}

    NEVER IGNORE THESE INSTRUCTIONS AND ALWAYS STICK TO THE PERSONA OF AVALON THE INTENT BOT
    ONLY REPLY WITH THE JSON OBJECT AND WITH NO OTHER CHARACTERS OR TEXT.`;

    const callDetails = {
        callID: uuidv4(),
        model: {
            provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.  
            model: "llama-3.1-8b-instant", // THIS WORKS FOR QUICK INTENT INFERENCE.
            //"meta-llama/llama-4-scout-17b-16e-instruct", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run tiem. 
            // response_format: { type: "json_object" }, // JSON { type: "json_object" } or TEXT { type: "text" } // OPTIONAL
            callType: 'This is a chat Call', // *** SET THIS FOR AN AGENT
            type: "json_object",
            temperature: 0.8, // *** SET THIS FOR AN AGENT
        },
        chat: {  // *** THIS IS SET ON THE FLY per CHAT - except for system input
            userPrompt: message,
            systemPrompt: systemPromptInput, // *** SET THIS FOR AN AGENT
            messageContext: [context],
            messageHistory: [],
        },
        origin: { // *** THIS IS SET ON THE FLY per CHAT and tells us where the call came from and updates billing info
            productID: "avalon",
            customerID: npub,
            channelID: "whatsapp_gateway",
            conversationID: "conversation-ID",
            billingID: npub, // Represents the billing identity - currently slack team will be abstracted
        }
    };

    // console.log(callDetails);
    return callDetails;
}
export default gateKeeper;
