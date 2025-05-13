// File path: netlify/functions/analyze-review.js

export async function handler(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (e) {
        console.error("Failed to parse request body:", e);
        return { statusCode: 400, body: 'Bad Request: Invalid JSON.' };
    }

    const reviewText = requestBody.review_text;

    if (!reviewText) {
        return { statusCode: 400, body: 'Bad Request: review_text is required in the request body.' };
    }

    // Get API Key, Endpoint URL, and your Assistant ID from Netlify environment variables
    const { OPENAI_API_KEY, OPENAI_ASSISTANT_API_ENDPOINT, OPENAI_ASSISTANT_ID } = process.env;

    if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_API_ENDPOINT || !OPENAI_ASSISTANT_ID) {
        console.error("Server Configuration Error: API Key, Endpoint, or Assistant ID is not set in Netlify environment variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Server configuration error. Please contact the site administrator.' })
        };
    }

    // Construct the request body for the "Create Thread and Run" endpoint
    const assistantRequestBody = {
        assistant_id: OPENAI_ASSISTANT_ID, // Your specific assistant ID from env var
        thread: {
            messages: [
                {
                    role: "user",
                    content: reviewText
                }
            ]
        }
        // You can add other parameters here if needed, e.g., model, instructions (if overriding assistant defaults)
        // For example, if your assistant is designed to output JSON, you might include:
        // "instructions": "Please analyze the review and respond in JSON format with fields: confidence_score, dispute_reason, description, and notes."
        // Or ensure your assistant is configured in the OpenAI dashboard to always respond in the desired JSON format.
    };

    try {
        const openaiResponse = await fetch(OPENAI_ASSISTANT_API_ENDPOINT, { // This should be https://api.openai.com/v1/threads/runs
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2' // Required header for Assistants API v2 features
            },
            body: JSON.stringify(assistantRequestBody)
        });

        const responseData = await openaiResponse.json();

        if (!openaiResponse.ok) {
            console.error('OpenAI API Error Status:', openaiResponse.status, 'Response Data:', responseData);
            return {
                statusCode: openaiResponse.status,
                body: JSON.stringify({
                    message: `OpenAI API Error: ${responseData.error?.message || openaiResponse.statusText || 'Unknown error from OpenAI'}`,
                    details: responseData.error?.code,
                    type: responseData.error?.type
                })
            };
        }

        // IMPORTANT: The 'responseData' here is a 'Run' object.
        // It is NOT the final JSON analysis from your assistant.
        // To get the assistant's actual message, you need to:
        // 1. Check the status of this run (responseData.id and responseData.thread_id).
        // 2. Poll until run.status is 'completed'.
        // 3. Retrieve messages from the thread.
        // This function would need to be significantly changed to implement that polling logic.
        // For now, we are returning the Run object. Your frontend will not be able to display the analysis yet.

        console.log("OpenAI Run Object:", responseData); // Log the Run object for debugging

        return {
            statusCode: 200,
            // Returning the Run object. The frontend needs to be aware of this.
            body: JSON.stringify({
                message: "Assistant run initiated. Further steps required to fetch results.",
                run_details: responseData // This is the Run object, not the final analysis.
            })
        };

    } catch (error) {
        console.error('Error in serverless function execution:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: `Internal Server Error: ${error.message}` })
        };
    }
}
