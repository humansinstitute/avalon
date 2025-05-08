// The purpose of agents is to setup the standard call parameters for a call to out backends.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time. Response details will be logged in mongo
// and referenced by the callID set in the guid below. 

async function contextBot(message, context, history) { //FILL IN VARIABLES
    const { v4: uuidv4 } = require('uuid');

    const systemPromptInput = `Your job is to take in a response from a vector database and use it to pull out relevant facts that can be fed to another agent in a conversation. The user prompt will be the vector databsae reponse. You will assess it against THE QUESTION below.

    *** 
    THE QUESTION IS: ${message}
    *** 

    *** 
    THE RESPONSE FROM THE VECTOR DB IS: ${context}
    *** 

    Please review the with thorough list of bullet points for example: 
    
    "Reviewing my knowlege base I bleive the following may be important: 
    - fact one blah blah blah
    - fact two blah blah blah"
    
    Plase ensure that all relevant details from the PROMPT are captured in this bullet point list.`;

    const callDetails = {
        callID: uuidv4(),
        model: {
            provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.  
            model: "meta-llama/llama-4-scout-17b-16e-instruct", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run tiem. 
            // response_format: { type: "json_object" }, // JSON { type: "json_object" } or TEXT { type: "text" } // OPTIONAL
            callType: 'This is a chat Call', // *** SET THIS FOR AN AGENT
            type: "completions",
            temperature: 0.4, // *** SET THIS FOR AN AGENT
        },
        chat: {  // *** THIS IS SET ON THE FLY per CHAT - except for system input
            userPrompt: message,
            systemPrompt: systemPromptInput, // *** SET THIS FOR AN AGENT
            messageContext: [context],
            messageHistory: history,
        },
        origin: { // *** THIS IS SET ON THE FLY per CHAT and tells us where the call came from and updates billing info
            productID: "tldr",
            customerID: "OS-Test",
            channelID: "OtherstuffStudio", //can change per instance of a caht bot
            conversationID: "conversation-ID",
            billingID: "OS-Test", // Represents the billing identity - currently slack team will be abstracted
        }
    };

    // console.log(callDetails);
    return callDetails;
}
module.exports = contextBot;