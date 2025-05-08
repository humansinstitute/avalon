/**
 * AI Wrapper Module
 * 
 * This module provides a unified interface for interacting with different AI providers
 * (Anthropic, OpenAI, and Groq). It handles message formatting, API calls, error handling,
 * and cost calculation for AI model usage.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import * as AnthropicSDK from '@anthropic-ai/sdk';
const Anthropic = AnthropicSDK.default;
import { OpenAI } from "openai";
import { observeOpenAI } from "langfuse";
import Groq from 'groq-sdk';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure dotenv
dotenv.config({ path: `${__dirname}/.env` });

/**
 * Prepares message history for Anthropic API calls
 * 
 * This function formats the conversation history to meet Anthropic's specific requirements:
 * - Merges consecutive messages from the same role
 * - Ensures alternating roles between user and assistant
 * - Incorporates system prompt, user prompt, and message context
 * 
 * @param {Array} messageHistory - Previous conversation messages
 * @param {string} systemPrompt - System-level instructions
 * @param {string} userPrompt - Current user input
 * @param {string} messageContext - Additional context for the conversation
 * @returns {Array} Formatted messages array for Anthropic API
 */
function prepareMessageHistoryAnt(messageHistory, systemPrompt, userPrompt, messageContext) {
    let messages = [];

    // Process message history
    if (Array.isArray(messageHistory) && messageHistory.length > 0) {
        for (let i = 0; i < messageHistory.length; i++) {
            if (i === 0 || messageHistory[i].role !== messageHistory[i - 1].role) {
                messages.push(messageHistory[i]);
            } else {
                // Merge consecutive messages of the same role
                messages[messages.length - 1].content += "\n\n" + messageHistory[i].content;
            }
        }
    }

    // Ensure alternating roles
    for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === messages[i + 1].role) {
            messages.splice(i + 1, 0, {
                role: messages[i].role === 'user' ? 'assistant' : 'user',
                content: 'Understood. Please continue.'
            });
        }
    }

    // Add message context if it exists
    if (messageContext && messageContext.length > 0) {
        if (messages.length === 0 || messages[messages.length - 1].role === 'assistant') {
            messages.push({ role: 'user', content: messageContext });
        } else {
            messages.push({ role: 'assistant', content: 'I understand. Please provide more information.' });
            messages.push({ role: 'user', content: messageContext });
        }
    }

    // Add final user prompt
    if (userPrompt && userPrompt.length > 0) {
        if (messages.length === 0 || messages[messages.length - 1].role === 'assistant') {
            messages.push({ role: 'user', content: userPrompt });
        } else {
            messages.push({ role: 'assistant', content: 'I see. What else can I help you with?' });
            messages.push({ role: 'user', content: userPrompt });
        }
    }
    // console.log('Consolidated message history is:\n', messages)
    return messages;
}

/**
 * Prepares message history for OpenAI API calls
 * 
 * Formats conversation history for OpenAI's chat completion API:
 * - Starts with system prompt
 * - Appends message history
 * - Adds message context if present
 * - Includes final user prompt
 * 
 * @param {Array} messageHistory - Previous conversation messages
 * @param {string} systemPrompt - System-level instructions
 * @param {string} userPrompt - Current user input
 * @param {string} messageContext - Additional context for the conversation
 * @returns {Array} Formatted messages array for OpenAI API
 */
function prepareMessageHistory(messageHistory, systemPrompt, userPrompt, messageContext) {
    const messages = [{ role: "system", content: systemPrompt }];

    if (Array.isArray(messageHistory) && messageHistory.length > 0) {
        messages.push(...messageHistory);
        const lastMessage = messageHistory[messageHistory.length - 1];
        if (lastMessage.role === 'user' && lastMessage.content === userPrompt) {
            return messages;
        }
    }

    if (messageContext && messageContext.length > 5) {
        messages.push({ role: "assistant", content: messageContext });
    }

    messages.push({ role: "user", content: userPrompt });
    return messages;
}

/**
 * Makes API call to the nominated model
 * 
 * Handles the interaction with the API specified int eh callDetails object:
 * - Formats messages using prepareMessageHistoryAnt
 * - Makes API call with specified parameters
 * - Calculates usage costs
 * - Returns standardized response format
 * 
 * @param {Object} callDetails - Configuration for the API call
 * @returns {Object} Standardized response with message and usage data
 */
async function callAntAI(callDetails) {
    const anthropic = new Anthropic({ apiKey: process.env.ANT_API });
    const messages = prepareMessageHistoryAnt(callDetails.chat.messageHistory, callDetails.chat.systemPrompt, callDetails.chat.userPrompt, callDetails.chat.messageContext);
    try {
        const response = await anthropic.messages.create({
            messages: messages,
            system: callDetails.chat.systemPrompt,
            model: callDetails.model.model,
            max_tokens: callDetails.model.max_tokens || 4096,
            temperature: callDetails.model.temperature,
        });

        const usage = response.usage;
        usage.model = callDetails.model.model;
        const costReturn = calculateLLMCost(usage, 'anthropic');

        return {
            callID: callDetails.callID,
            billingID: callDetails.origin.billingID,
            message: response.content[0].text,
            usage: { ...usage, costs: costReturn }
        };
    } catch (error) {
        return {
            callID: "error",
            billingID: "error",
            message: `An error occurred: ${error.message}`,
            usage: "error"
        };
    }
}

/**
 * Makes API call to OpenAI's chat completion endpoint
 * 
 * Handles OpenAI API interactions with Langfuse observation:
 * - Formats messages using prepareMessageHistory
 * - Makes API call with specified parameters
 * - Tracks usage with Langfuse
 * - Calculates usage costs
 * - Returns standardized response format
 * 
 * @param {Object} callDetails - Configuration for the API call
 * @returns {Object} Standardized response with message and usage data
 */
async function callOpenAI(callDetails) {
    const openAiBase = new OpenAI({ apiKey: process.env.OPENAI_API });
    const openai = observeOpenAI(openAiBase, {
        generationName: `${callDetails.model.callType}`,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        baseUrl: process.env.LANGFUSE_BASEURL,
        userId: callDetails.origin.billingID,
        sessionId: callDetails.origin.conversationID,
        metadata: {
            activity: 'chat',
            environment: 'everest-api',
            billingID: callDetails.origin.billingID,
            slackUser: callDetails.origin.userID,
        }
    });

    try {
        const response = await openai.chat.completions.create({
            model: callDetails.model.model,
            messages: prepareMessageHistory(callDetails.chat.messageHistory, callDetails.chat.systemPrompt, callDetails.chat.userPrompt, callDetails.chat.messageContext),
            temperature: callDetails.model.temperature,
            n: 1,
            max_tokens: callDetails.model.max_tokens || 4096,
        });

        const usage = response.usage;
        usage.model = callDetails.model.model;
        const costReturn = calculateLLMCost(usage, 'openai');

        return {
            callID: callDetails.callID,
            billingID: callDetails.origin.billingID,
            message: response.choices[0].message.content.trim(),
            usage: { ...usage, costs: costReturn }
        };
    } catch (error) {
        return {
            callID: "error",
            billingID: "error",
            message: `An error occurred: ${error.message}`,
            usage: "error"
        };
    }
}

/**
 * Makes API call to OpenAI with JSON response format
 * 
 * Specialized version for OpenAI calls requiring JSON responses:
 * - Uses specific response format configuration
 * - Handles JSON parsing and error cases
 * - Returns parsed JSON response
 * 
 * @param {Object} callDetails - Configuration for the API call
 * @returns {Object} Standardized response with parsed JSON message
 */
async function callOpenAIJSON(callDetails) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API });

    try {
        const response = await openai.chat.completions.create({
            model: callDetails.model.model,
            messages: prepareMessageHistory(callDetails.chat.messageHistory, callDetails.chat.systemPrompt, callDetails.chat.userPrompt),
            temperature: callDetails.model.temperature,
            n: 1,
            response_format: callDetails.model.response_format,
            max_tokens: callDetails.model.max_tokens || 4096,
        });

        // console.log("Raw OpenAI JSON response:", response.choices[0].message.content);

        let parsedMessage;
        try {
            // First, try to parse it as-is
            parsedMessage = JSON.parse(response.choices[0].message.content.trim());
        } catch (parseError) {
            console.log("Initial JSON parsing failed, attempting to fix the format, not parsing");
            parsedMessage = response.choices[0].message.content.trim();
            // // If that fails, try to fix the format and parse again
            // const fixedContent = response.choices[0].message.content.replace(/(\w+):/g, '"$1":');
            // try {
            //     parsedMessage = JSON.parse(fixedContent);
            // } catch (secondParseError) {
            //     console.error("JSON parsing error even after fixing format:", secondParseError);
            //     parsedMessage = { error: "Failed to parse JSON response", raw: response.choices[0].message.content };
            // }
        }

        const usage = response.usage;
        usage.model = callDetails.model.model;
        const costReturn = calculateLLMCost(usage, 'openai');

        return {
            callID: callDetails.callID,
            billingID: callDetails.origin.billingID,
            message: parsedMessage,
            usage: { ...usage, costs: costReturn }
        };
    } catch (error) {
        console.error("OpenAI API error:", error);
        return {
            callID: "error",
            billingID: "error",
            message: `An error occurred: ${error.message}`,
            usage: "error"
        };
    }
}

/**
 * Makes API call to Groq's API with retry mechanism
 * 
 * Handles Groq API interactions with built-in retry logic:
 * - Implements exponential backoff for failed requests
 * - Formats messages using prepareMessageHistory
 * - Returns standardized response format
 * 
 * @param {Object} callDetails - Configuration for the API call
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Initial delay between retries in milliseconds
 * @returns {Object} Standardized response with message and usage data
 */
async function callGroqAI(callDetails, maxRetries = 3, delay = 500) {
    const groq = new Groq({
        apiKey: process.env.GROQ_API
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                messages: prepareMessageHistory(callDetails.chat.messageHistory, callDetails.chat.systemPrompt, callDetails.chat.userPrompt, callDetails.chat.messageContext),
                model: callDetails.model.model,
                max_tokens: callDetails.model.max_tokens || 4096,
            });

            return {
                callID: callDetails.callID,
                billingID: callDetails.origin.billingID,
                message: response.choices[0].message.content.trim(),
                usage: { model: callDetails.model.model, costs: { input: 0, output: 0, total: 0 } }
            };
        } catch (error) {
            if (error.response && error.response.status === 503 && attempt < maxRetries) {
                console.log(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                return {
                    callID: "error",
                    billingID: "error",
                    message: `An error occurred: ${error.message}`,
                    usage: "error"
                };
            }
        }
    }
}

/**
 * Makes API call to Groq's API with JSON response format
 * 
 * Specialized version for Groq calls requiring JSON responses:
 * - Uses specific response format configuration
 * - Handles JSON parsing and error cases
 * - Returns parsed JSON response
 * 
 * @param {Object} callDetails - Configuration for the API call
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Initial delay between retries in milliseconds
 * @returns {Object} Standardized response with parsed JSON message
 */
async function callGroqAIJSON(callDetails, maxRetries = 3, delay = 500) {
    const groq = new Groq({
        apiKey: process.env.GROQ_API
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                messages: prepareMessageHistory(callDetails.chat.messageHistory, callDetails.chat.systemPrompt, callDetails.chat.userPrompt, callDetails.chat.messageContext),
                model: callDetails.model.model,
                max_tokens: callDetails.model.max_tokens || 4096,
                temperature: callDetails.model.temperature,
                response_format: { type: "json_object" }
            });

            let parsedMessage;
            try {
                parsedMessage = JSON.parse(response.choices[0].message.content.trim());
            } catch (parseError) {
                console.log("JSON parsing failed, returning raw content");
                parsedMessage = response.choices[0].message.content.trim();
            }

            return {
                callID: callDetails.callID,
                billingID: callDetails.origin.billingID,
                message: parsedMessage,
                usage: { model: callDetails.model.model, costs: { input: 0, output: 0, total: 0 } }
            };
        } catch (error) {
            if (error.response && error.response.status === 503 && attempt < maxRetries) {
                console.log(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                return {
                    callID: "error",
                    billingID: "error",
                    message: `An error occurred: ${error.message}`,
                    usage: "error"
                };
            }
        }
    }
}

/**
 * Calculates the cost of LLM API usage
 * 
 * Computes the cost based on token usage and provider-specific rates:
 * - Supports Anthropic, OpenAI, and Groq pricing models
 * - Handles different token counting methods
 * - Returns detailed cost breakdown
 * 
 * @param {Object} usage - Token usage statistics
 * @param {string} provider - AI provider name
 * @returns {Object} Cost breakdown including input, output, and total costs
 */
function calculateLLMCost(usage, provider) {
    let inputCostPerMillion, outputCostPerMillion;

    switch (provider.toLowerCase()) {
        case 'anthropic':
            inputCostPerMillion = 3.00;
            outputCostPerMillion = 15.00;
            break;
        case 'openai':
            inputCostPerMillion = 5.00;
            outputCostPerMillion = 15.00;
            break;
        case 'groq':
            return { input: 0, output: 0, total: 0 };
        default:
            throw new Error("Unknown provider");
    }

    const inputTokens = usage.input_tokens || usage.prompt_tokens;
    const outputTokens = usage.output_tokens || usage.completion_tokens;

    const inputCost = (inputTokens / 1000000) * inputCostPerMillion;
    const outputCost = (outputTokens / 1000000) * outputCostPerMillion;
    const totalCost = inputCost + outputCost;
    // Start of Selection
    console.log(`Input Cost: ${inputCost}, output: ${outputCost}, total: ${totalCost}`);

    return { input: inputCost, output: outputCost, total: inputCost + outputCost };
}

/**
 * Main wrapper function for AI provider interactions
 * 
 * Acts as a unified entry point for all AI provider calls:
 * - Routes requests to appropriate provider handler
 * - Handles error cases consistently
 * - Returns standardized response format
 * 
 * @param {Object} callDetails - Configuration for the API call
 * @returns {Object} Standardized response with message and usage data
 */
async function aiWrapper(callDetails) {
    let objectResponse;
    const provider = callDetails.model.provider.toLowerCase();

    try {
        console.log("Attempting to call provider:", provider);
        if (provider === 'anthropic') {
            objectResponse = await callAntAI(callDetails);
        } else if (provider === 'openai') {
            if (callDetails.model.type === 'json_object') {
                console.log("Calling OpenAI JSON");
                objectResponse = await callOpenAIJSON(callDetails);
            } else {
                console.log("Calling OpenAI standard");
                objectResponse = await callOpenAI(callDetails);
            }
        } else if (provider === 'groq') {
            if (callDetails.model.type === 'json_object') {
                console.log("Calling Groq JSON");
                objectResponse = await callGroqAIJSON(callDetails);
            } else {
                objectResponse = await callGroqAI(callDetails);
            }
        } else {
            throw new Error("Unsupported AI provider");
        }
        // console.log("AI response:", objectResponse);
    } catch (error) {
        console.error("Error in aiWrapper:", error);
        objectResponse = {
            callID: "error",
            billingID: "error",
            message: `An error occurred: ${error.message}`,
            usage: "error"
        };
    }

    return objectResponse;
}

export default aiWrapper;
