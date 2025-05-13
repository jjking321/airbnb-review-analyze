// File path: netlify/functions/analyze-review.js

// This is an ES module, so we use export async function.
export async function handler(event) {
    // 1. Only allow POST requests
    // The frontend will send a POST request with the review text.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 2. Parse the incoming review text from the frontend's request body
    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (e) {
        console.error("Failed to parse request body:", e);
        return { statusCode: 400, body: 'Bad Request: Invalid JSON.' };
    }

    const reviewText = requestBody.review_text;

    // Ensure review_text was provided
    if (!reviewText) {
        return { statusCode: 400, body: 'Bad Request: review_text is required in the request body.' };
    }

    // 3. Get your OpenAI API Key and your specific Assistant Endpoint URL
    // These are securely stored as environment variables in your Netlify site settings.
    const { OPENAI_API_KEY, OPENAI_ASSISTANT_API_ENDPOINT } = process.env;

    // Check if the environment variables are set
    if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_API_ENDPOINT) {
        console.error("Server Configuration Error: OPENAI_API_KEY or OPENAI_ASSISTANT_API_ENDPOINT is not set in Netlify environment variables.");
        return {
            statusCode: 500, // Internal Server Error
            body: JSON.stringify({ message: 'Server configuration error. Please contact the site administrator.' })
        };
    }

    // 4. Call the OpenAI Assistant API
    try {
        const openaiResponse = await fetch(OPENAI_ASSISTANT_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}` // Use the API key from environment variables
            },
            // IMPORTANT: This is the body sent to YOUR OpenAI Assistant.
            // You confirmed your assistant expects a JSON like:
            // {
            //   "confidence_score": 9,
            //   "dispute_reason": "...",
            //   "description": "...",
            //   "notes": "..."
            // }
            // However, that was the *output* format. The *input* to your pre-configured assistant
            // is likely just the text or the text within a simple JSON structure.
            // Assuming your assistant is configured to take the review text directly or in a field like "input" or "prompt".
            // If your assistant expects {"review_text": "actual review"}, this is correct:
            body: JSON.stringify({
                 review_text: reviewText
                // If your assistant expects something else, like:
                // "input": reviewText,
                // or
                // "prompt": reviewText,
                // or if it's a call to a specific model with more parameters,
                // you MUST adjust this body to match what YOUR assistant endpoint requires.
            })
        });

        // Try to parse the response from OpenAI as JSON
        const responseData = await openaiResponse.json();

        // Check if the call to OpenAI was not successful
        if (!openaiResponse.ok) {
            console.error('OpenAI API Error:', openaiResponse.status, responseData);
            // Forward a structured error to the client if possible
            return {
                statusCode: openaiResponse.status, // e.g., 400, 401, 500 from OpenAI
                body: JSON.stringify({
                    message: `OpenAI API Error: ${responseData.error?.message || openaiResponse.statusText || 'Unknown error from OpenAI'}`,
                    details: responseData.error?.code // Include error code if available
                })
            };
        }

        // 5. Return the successful response from OpenAI to the frontend
        return {
            statusCode: 200,
            body: JSON.stringify(responseData) // This is the JSON your frontend expects
        };

    } catch (error) {
        // Catch any other errors during the fetch call or JSON parsing
        console.error('Error in serverless function execution:', error);
        return {
            statusCode: 500, // Internal Server Error
            body: JSON.stringify({ message: `Internal Server Error: ${error.message}` })
        };
    }
}
