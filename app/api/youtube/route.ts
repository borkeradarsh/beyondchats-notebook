import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  console.log("YouTube API route hit.");

  try {
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (!googleApiKey) {
      throw new Error("Missing Google API Key environment variable.");
    }

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const { topic, documentContent } = await request.json();

    if (!topic && !documentContent) {
      return NextResponse.json({ error: 'Topic or document content is required.' }, { status: 400 });
    }

    // Create a more targeted prompt based on document content or topic
    let prompt = '';
    
    if (documentContent) {
      prompt = `
        You are an expert at finding educational content on YouTube.
        Based on the document content below, analyze the key topics and concepts, then generate a list of 5 relevant and helpful YouTube video recommendations for a student studying this material.

        Document Content:
        ${documentContent.substring(0, 3000)} ${documentContent.length > 3000 ? '...' : ''}

        Return a single JSON object with one key: "videos".
        The value should be an array of 5 video objects.

        For each video object, provide:
        - "title": A concise, engaging, and descriptive title for the video that relates to the document content.
        - "search_query": The ideal search query a user should type into YouTube to find this type of video.

        Focus on the main concepts, theories, or subjects covered in the document. Make the recommendations specific and educational.
      `;
    } else {
      prompt = `
        You are an expert at finding educational content on YouTube.
        For the topic "${topic}", generate a list of 5 relevant and helpful video ideas for a student.

        Return a single JSON object with one key: "videos".
        The value should be an array of 5 video objects.

        For each video object, provide:
        - "title": A concise, engaging, and descriptive title for the video.
        - "search_query": The ideal search query a user should type into YouTube to find this type of video.
      `;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up the response to ensure it's valid JSON
    const jsonResponse = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text, parseError);
      return NextResponse.json({ error: 'Failed to generate valid video recommendations' }, { status: 500 });
    }

    // Validate the response structure
    if (!parsedResponse.videos || !Array.isArray(parsedResponse.videos)) {
      return NextResponse.json({ error: 'Invalid video recommendations format' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      videos: parsedResponse.videos
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('--- YOUTUBE API CRASH ---', errorMessage);
    return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
}