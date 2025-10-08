import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error('GOOGLE_API_KEY is not configured');
}

const genAI = new GoogleGenerativeAI(apiKey);

export const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

export async function generateChatResponse(prompt: string, context: string): Promise<string> {
  try {
    const enhancedPrompt = `
Context from PDF document:
${context}

User question: ${prompt}

Please provide a helpful and accurate response based on the context provided. If the answer isn't in the context, please say so clearly.
`;

    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error('Failed to generate response');
  }
}

export async function generateQuiz(content: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<{ title: string; questions: unknown[] }> {
  try {
    const prompt = `
Based on the following content, generate a quiz with 5 questions of ${difficulty} difficulty:

${content}

Format the response as a JSON object with the following structure:
{
  "title": "Quiz Title",
  "questions": [
    {
      "id": "unique_id",
      "question": "Question text",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "explanation": "Explanation of why this is correct",
      "pageReference": 1
    }
  ]
}

Mix different question types: multiple-choice, true-false, and short-answer.
Ensure all questions are based on the provided content.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up the response to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw new Error('Failed to generate quiz');
  }
}

export async function generateExplanation(text: string, context: string): Promise<string> {
  try {
    const prompt = `
Explain the following text in simple terms, providing context and examples where helpful:

Text to explain: "${text}"

Context: ${context}

Provide a clear, concise explanation that would help someone understand this concept better.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating explanation:', error);
    throw new Error('Failed to generate explanation');
  }
}

export async function findCitations(query: string, content: string): Promise<unknown[]> {
  try {
    const prompt = `
Find relevant citations from the following content for the query: "${query}"

Content: ${content}

Return citations as a JSON array with this structure:
[
  {
    "id": "unique_id",
    "text": "relevant excerpt from content",
    "pageNumber": 1,
    "confidence": 0.85
  }
]

Only include citations with confidence > 0.7
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [];
  } catch (error) {
    console.error('Error finding citations:', error);
    return [];
  }
}