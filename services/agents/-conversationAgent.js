// The purpose of agents is to setup the standard call parameters for a call to our backends.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time. Response details will be logged in mongo
// and referenced by the callID set in the guid below. 

const { v4: uuidv4 } = require('uuid');

// Get current date in a readable format
const dayToday = new Date().toLocaleDateString('en-AU', {
   weekday: 'long',
   year: 'numeric',
   month: 'long',
   day: 'numeric'
});

// artefactsObject inclludes three key varioables for fact extraction
// artefactsObject.artefactFrame -> The template of the artefact type we're trying to gather details on
// artefactsObject.artefactInitial -> The start point prior to the conversation
// artefactsObject.artefact -> The latest version of the artefact.

// conversation includes:
// conversation.message -> The last user message
// conversation.history -> the conversation history
// conversation.artefacts[0] -> current artefact
// conversation.artefactFrame -> The template of the artefact type we're trying to gather details on
// conversation.artefactInitial 

async function conversationAgent(conversation, context, artefactsObject) { //FILL IN VARIABLES
   // const contextInsert = JSON.stringify(context.message);
   const systemPromptInput = `I want you to act as a friendly and knowledgeable product manager taking a brief in a conversational manner from a user. As you progress through the conversation, you have one objective:
    
    **Objective:** Establish the following information, in the order presented as described in the Artefact below, defined by this JSON document. 
   

    ******
    ARTEFACT
    ${JSON.stringify(artefactsObject.artefactFrame)}
    ******
    
    *******
    THE CURRENT STATE OF THE ARTEFACT IS:
    ${JSON.stringify(artefactsObject.artefact)}
    *******
     
    KEEP YOUR RESPONSES CONCISE AND USE MARKDOWN FORMATTING AND SPACING FOR EASY READABILITY.
        
    Try and stick to establishing one piece of information or goal per response.`;

   const callDetails = {
      callID: uuidv4(),
      model: {
         provider: "anthropic", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.  
         // model: "meta-llama/llama-4-scout-17b-16e-instruct",
         model: "claude-3-5-sonnet-20240620", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run tiem. 
         // response_format: { type: "json_object" }, // JSON { type: "json_object" } or TEXT { type: "text" } // OPTIONAL
         callType: 'This is a chat Call', // *** SET THIS FOR AN AGENT
         type: "completion",
         max_tokens: 4096,
         temperature: 0.8, // *** SET THIS FOR AN AGENT
      },
      chat: {  // *** THIS IS SET ON THE FLY per CHAT - except for system input
         userPrompt: conversation.message,
         systemPrompt: systemPromptInput, // *** SET THIS FOR AN AGENT
         messageContext: context,
         messageHistory: conversation.history,
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
module.exports = conversationAgent;