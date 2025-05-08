// The purpose of agents is to setup the standard call parameters for a call to out backends.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time. Response details will be logged in mongo
// and referenced by the callID set in the guid below. 

import { v4 as uuidv4 } from 'uuid';

async function extractPost(message, context, npub) { //FILL IN VARIABLES

    const systemPromptInput = `From the messagein your prompt please extract the specific post the user is looking to make and output a JSON object with the post and reasoning. Plesase remove all of the surrounding text nad isolate only the post the user is trying to make in the variable "post".  
    
    E.g. 
    "post to nostr - hello teddy fashion boutique" should be "post" = "hello teddy fashion boutique"
    "can you post to nnostr hello world" should be "post" = "hello world"

    Please answer in a JSON OBJECT:
     { "post": "What is the specific post teh user is looking to make with no other text added", "reasoning": "Please explain your why you extract that post from the user message"}

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
export default extractPost;
