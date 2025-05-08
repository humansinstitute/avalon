// The purpose of agents is to setup the standard call parameters for a call to out backends.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time. Response details will be logged in mongo
// and referenced by the callID set in the guid below. 

async function artefactAgent(message, context, history, artefactsObject) { //FILL IN VARIABLES
    const { v4: uuidv4 } = require('uuid');
    // Convert history array to a formatted string
    const historyString = history.map(entry =>
        `${entry.role.toUpperCase()}: ${entry.content}`
    ).join('\n\n');

    // artefactsObject inclludes three key varioables for fact extraction
    // artefactsObject.artefactFrame -> The template of the artefact type we're trying to gather details on
    // artefactsObject.artefactInitial -> The start point prior to the conversation
    // artefactsObject.artefact -> The latest version of the artefact.

    const systemPromptInput = `You are an experienced Senior Product manager. Please review the message, conversation history and current artefact state. 
    
    You objective is to improve the artefact and ensure that we have a clear artefact that descirbes this product based on the following JSON Example:

    EXAMPLE JSON DESCRIPTION
    ${JSON.stringify(artefactsObject.artefactFrame)}

    *******
    The current artefact details are:

    ${JSON.stringify(artefactsObject.artefact)}

    *******

    - Please review the conversation and update the artefact with additinal facts from the conversation.
    - Do not remove interesting facts from earlier in the conversation but build upon them. 

    HERE IS THE MESSAGE HISTORY OF THIS CONVERSATION:
    
    Last Message: ${message} 
    Message History: ${historyString}
        
    ONLY REPLY ONLY WITH THE JSON OBJECT AND WITH NO OTHER CHARACTERS OR TEXT DO NOT OUTPUT CODEBLOCK TRIPPLE BAKCTICKS JUST SEND THE OBJECT`;

    const callDetails = {
        callID: uuidv4(),
        model: {
            provider: "openai", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.  
            model: "gpt-4o-mini", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run tiem. 
            // provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.  
            // model: "meta-llama/llama-4-scout-17b-16e-instruct", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run time. 
            callType: 'This is a chat Call', // *** SET THIS FOR AN AGENT
            type: "json_object",
            temperature: 0.8, // *** SET THIS FOR AN AGENT
        },
        chat: {  // *** THIS IS SET ON THE FLY per CHAT - except for system input
            userPrompt: message,
            systemPrompt: systemPromptInput, // *** SET THIS FOR AN AGENT
            messageContext: context,
            messageHistory: [],
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
module.exports = artefactAgent;