import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Generate a short, descriptive mandate name based on the innovation topic
 * using Gemini 2.0 Flash API
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic } = req.body;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const prompt = `You are a naming specialist for innovation mandates. Given a topic, generate a concise (3-5 words), descriptive name for the mandate.

Topic: "${topic}"

Requirements:
- Must be 3-5 words maximum
- Should capture the core innovation focus
- Should be professional and clear
- Avoid generic terms like "innovation" or "initiative"
- Return ONLY the name, no additional text or explanation

Name:`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 50,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API error:', error);
      return res.status(500).json({ error: 'Failed to generate mandate name' });
    }

    const data = await response.json();
    const generatedName = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!generatedName) {
      // Fallback to truncated topic if generation fails
      const fallbackName = topic.substring(0, 50);
      return res.status(200).json({ name: fallbackName });
    }

    res.status(200).json({ name: generatedName });
  } catch (error) {
    console.error('Error generating mandate name:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
