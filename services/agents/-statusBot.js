// The purpose of agents is to setup the standard call parameters for a call to out backends.
// Each specific named agent will have a specific setup for the model and system prompts and
// Other parameters the will be set at run time. Response details will be logged in mongo
// and referenced by the callID set in the guid below.

async function statusBot(message, context, history, facts) { // Renamed function
    const { v4: uuidv4 } = require('uuid');
    // Convert history array to a formatted string
    const historyString = history.map(entry =>
        `${entry.role.toUpperCase()}: ${entry.content}`
    ).join('\n\n');

    const systemPromptInput = `Please review the current set of FACTS and the LAST MESSAGE received and CONVERSATION HISTORY presented. 
    Your job is to make a call on whether we have correctly completed the job of establishing a brief that completes the FACTS object with the following information. 

    THE EXAMPLE FACTS OBJECT
    {
        "facts": {
            "basic_info": {
                "name": "Full name of the user",
                "company": "Company or organization name",
                "industry": "Industry or sector they operate in",
                "email": "Email address of the user"
            },
            "website_info": {
                "purpose": "Primary purpose of the website (informational, e-commerce, portfolio, etc.)",
                "goals": ["List of business goals for the website"],
                "target_audience": "Description of target audience demographics and behaviors",
                "site_type": "ecommerce | portfolio | brochure | other"
                "pageList": "List of main pages for the website",
            }
        }
    }

    BASED on your analysis provide analysis with a STATUS object in your reposne. 

    RESPONSE JSON OBJECT 
    {
        "status": "complete | wip",
        "reasoning":"Why have you selected this status"
    }

    ONLY SELECT "complete" WHEN all "basic_info" and "website_info" is fully completed and clear AND THE "LAST MESSAGE" indicates we have all facts established.
    
    OTHERWISE SELECT "wip"

    *******
    The current facts you know right now are:
    ${facts}
    *******

    HERE IS THE MESSAGE HISTORY OF THIS CONVERSATION:
    LAST MESSAGE: ${message} 

    MESSAGE HISTORY: ${historyString}
        
    BEFORE YOU OUTPUT PLEASE REFLECT ON YOUR THINKING AND THE STATUS YOU HAVE CHOSEN.

    ONLY REPLY WITH THE ** RESPONSE JSON OBJECT ** AND WITH NO OTHER CHARACTERS OR TEXT PLEASE ENSURE YOU TAKR ACCOUNT OF LAST MESSAGE TO CHECK WHETHER WE ARE COMPLETE.`;

    const callDetails = {
        callID: uuidv4(),
        model: {
            // provider: "openai", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.  
            // model: "gpt-4o", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run tiem. 
            provider: "groq", // *** SET THIS FOR AN AGENT - will tell call which SDK client to pick.  
            model: "meta-llama/llama-4-scout-17b-16e-instruct", // // *** SET THIS FOR AN AGENT "gpt-4o" default model can be overridden at run tiem. 
            // response_format: { type: "json_object" }, // JSON { type: "json_object" } or TEXT { type: "text" } // OPTIONAL
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
module.exports = statusBot; // Updated module export
