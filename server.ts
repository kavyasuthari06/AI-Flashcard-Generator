/**
 * @file server.ts
 * @description Full-stack Express backend server for RecallMate AI.
 * Handles server-side Google Gemini API integration (gemini-3.8-flash) for AI flashcard synthesis,
 * multiple-choice quiz generation, health checks, and Vite middleware integration.
 * Ensures the GEMINI_API_KEY is never exposed to the client browser.
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables from .env file
dotenv.config();

// Determine directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express web server application
const app = express();
const PORT = process.env.PORT || 3000;

// Configure body parser with a 50MB payload limit to support larger note and document uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize the Google GenAI client with official telemetry User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * GET /api/health
 * Simple health check route to verify server status and API key configuration
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/generate-flashcards
 * Generates structured flashcards (Concept cards, Q&A cards, or both) from:
 * 1. A typed study topic
 * 2. Uploaded PDF or Word document text
 * 3. Pasted student study notes
 */
app.post('/api/generate-flashcards', async (req, res) => {
  try {
    const {
      content = '',
      inputMode = 'paste', // 'topic' | 'pdf' | 'docx' | 'paste'
      topic = '',
      cardTypeMode = 'both', // 'qa' | 'concept' | 'both'
      count = 10,
      difficulty = 'Intermediate',
      style = 'Mixed',
      subject = 'General',
      deckTitle = 'Study Deck',
    } = req.body;

    const effectiveTopic = String(topic || '').trim();
    const effectiveContent = String(content || '').trim();

    // Input validation: ensure either a topic or substantial note content is provided
    if (inputMode === 'topic' && !effectiveTopic && effectiveContent.length < 2) {
      return res.status(400).json({
        error: 'Please enter a valid study topic (e.g. "Photosynthesis", "Binary Search Trees").',
      });
    }

    if (inputMode !== 'topic' && effectiveContent.length < 15) {
      return res.status(400).json({
        error: 'Please provide at least 15 characters of study material to generate flashcards.',
      });
    }

    // Verify Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check environment secrets.',
      });
    }

    // Bound requested card count safely between 3 and 25 per request
    const cardCount = Math.min(Math.max(Number(count) || 10, 3), 25);

    // Build specialized card type instructions for Gemini
    let cardTypeInstructions = '';
    if (cardTypeMode === 'concept') {
      cardTypeInstructions = `Generate ONLY "Concept & Key Points" cards:
- Each card focuses on a distinct core concept, principle, mechanism, or term.
- Set cardType to "concept".
- In "question", provide the clear Concept Title / Name (e.g., "The Heisenberg Uncertainty Principle", "Mitochondrial Chemiosmosis").
- In "answer", provide a clear, concise definition or summary of the concept.
- In "keyPoints", provide an array of 2 to 4 bulleted key points or essential takeaways.`;
    } else if (cardTypeMode === 'qa') {
      cardTypeInstructions = `Generate ONLY "Question & Answer" cards:
- Each card tests knowledge with a direct, exam-style question.
- Set cardType to "qa".
- In "question", ask a clear, unambiguous question that tests understanding or recall.
- In "answer", provide a direct, concise, and accurate answer.
- "keyPoints" can be an empty array or 1-2 memory hooks.`;
    } else {
      cardTypeInstructions = `Generate BOTH "Concept & Key Points" cards and "Question & Answer" cards:
- Provide a balanced mix: approximately half as "concept" cards and half as "qa" cards.
- For "concept" cards: "question" is the Concept Name/Title, "answer" is the concise explanation, and "keyPoints" has 2-4 key takeaways.
- For "qa" cards: "question" is a test question, and "answer" is the direct answer.
- Clearly set cardType to either "concept" or "qa" for each card.`;
    }

    let sourceContextInstructions = '';
    let userPrompt = '';

    if (inputMode === 'topic' || (effectiveTopic && effectiveContent.length < 50)) {
      const topicToStudy = effectiveTopic || effectiveContent;
      sourceContextInstructions = `The student wants to learn the specific topic: "${topicToStudy}" (Subject: "${subject || 'General'}").
Generate accurate, high-yield, curriculum-standard revision flashcards covering this exact topic comprehensively according to the requested difficulty level (${difficulty}).`;

      userPrompt = `Study Topic: "${topicToStudy}"
Subject: "${subject || topicToStudy}"
Difficulty: "${difficulty}"
Question Style: "${style}"
Deck Title: "${deckTitle || topicToStudy}"

Generate exactly ${cardCount} flashcards according to the rules.`;
    } else {
      sourceContextInstructions = `Generate flashcards based strictly on the user-provided study material below.
Extract all key concepts, definitions, principles, and revision information only from this source text. Do NOT hallucinate external facts.`;

      userPrompt = `User's Provided Study Material (Subject: ${subject}, Title: ${deckTitle}):
----------------------------------------
${effectiveContent.slice(0, 48000)}
----------------------------------------

Generate exactly ${cardCount} flashcards according to the rules.`;
    }

    const systemPrompt = `You are RecallMate AI, a professional educational synthesizer creating exam-ready flashcards.
Follow these strict instructions:
1. ${sourceContextInstructions}
2. ${cardTypeInstructions}
3. Prioritize exam-revision value, clarity, and precision.
4. Explanations must provide context or an intuitive memory aid.
5. Respect the chosen difficulty: "${difficulty}".
6. Respect the question style: "${style}".
7. Return exactly ${cardCount} flashcards in valid JSON matching the schema.`;

    // Invoke Gemini model with structured JSON output schema
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: `Array of ${cardCount} flashcard objects`,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: 'Unique identifier for the card' },
              cardType: { type: Type.STRING, description: 'Either "concept" or "qa"' },
              question: { type: Type.STRING, description: 'Question for QA cards, or Concept Title for concept cards' },
              answer: { type: Type.STRING, description: 'Answer for QA cards, or Concept Summary for concept cards' },
              keyPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 bulleted key points for concept cards',
              },
              explanation: { type: Type.STRING, description: 'Clear explanation or memory aid' },
              topic: { type: Type.STRING, description: 'Specific subtopic or concept area' },
              difficulty: { type: Type.STRING, description: 'Beginner, Intermediate, or Advanced' },
              sourceExcerpt: { type: Type.STRING, description: 'Direct excerpt or reference' },
            },
            required: ['question', 'answer', 'explanation', 'topic'],
          },
        },
      },
    });

    const rawText = response.text || '[]';
    let cards = [];
    try {
      cards = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cards = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Gemini JSON response');
      }
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(502).json({
        error: 'The AI model returned an empty list of cards. Please verify that your input contains sufficient explanatory material.',
      });
    }

    // Sanitize generated cards and initialize unreviewed category status
    const sanitizedCards = cards.map((card: any, idx: number) => {
      const isConcept = card.cardType === 'concept' || (!card.cardType && cardTypeMode === 'concept');
      const cardType = isConcept ? 'concept' : 'qa';

      return {
        id: card.id || `card-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        cardType,
        question: String(card.question || '').trim(),
        answer: String(card.answer || '').trim(),
        keyPoints: Array.isArray(card.keyPoints)
          ? card.keyPoints.map((p: any) => String(p).trim()).filter(Boolean)
          : [],
        explanation: String(card.explanation || '').trim(),
        topic: String(card.topic || effectiveTopic || subject || 'General').trim(),
        difficulty: card.difficulty || difficulty,
        sourceExcerpt: card.sourceExcerpt || (inputMode === 'topic' ? `Topic: ${effectiveTopic || subject}` : `Derived from study notes on ${subject}`),
        reviewsCount: 0,
        lastReviewedDate: null,
        // Newly generated cards remain Unclassified ('unreviewed') until the user categorizes them
        recallRating: 'unreviewed',
        nextReviewDate: null,
        reviewHistory: [],
        streak: 0,
      };
    });

    res.json({
      success: true,
      cards: sanitizedCards,
      count: sanitizedCards.length,
      deckTitle,
      subject: effectiveTopic || subject,
      cardTypeMode,
    });
  } catch (err: any) {
    console.error('Error generating flashcards with Gemini:', err);
    res.status(500).json({
      error: err?.message || 'Failed to generate flashcards with Gemini. Please try again.',
    });
  }
});

/**
 * POST /api/generate-quiz
 * Generates multiple-choice quiz questions strictly grounded in a deck's flashcards
 */
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const {
      deckTitle = 'Study Deck',
      subject = 'General',
      cards = [],
      sourceNotes = '',
      questionCount = 5,
      difficulty = 'Intermediate',
    } = req.body;

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        error: 'Please provide flashcards to generate a quiz from.',
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const requestedCount = Math.min(Math.max(Number(questionCount) || 5, 3), 15);

    // Summarize flashcards into a clean prompt context
    const cardsSummary = cards
      .map(
        (c: any, i: number) =>
          `[Card ${i + 1}] Topic: ${c.topic}\nQ: ${c.question}\nA: ${c.answer}\nNote: ${c.explanation || ''}`
      )
      .join('\n\n');

    const promptContext = sourceNotes
      ? `Source Notes:\n${sourceNotes.slice(0, 20000)}\n\nFlashcards:\n${cardsSummary}`
      : `Flashcards:\n${cardsSummary}`;

    const systemPrompt = `You are RecallMate AI's Quiz Generator.
Your task is to create high-quality multiple-choice questions (MCQs) strictly grounded in the provided flashcards and notes for the subject "${subject}" (Deck: "${deckTitle}").
Rules:
1. Generate exactly ${requestedCount} questions.
2. For each question, provide exactly 4 distinct, plausible options (A, B, C, D).
3. Exactly ONE option must be completely correct.
4. The remaining 3 options must be plausible distractors related to the topic, not joke answers.
5. Identify the 0-based index of the correct answer (0, 1, 2, or 3).
6. Provide a concise explanation explaining why the correct answer is right and why the distractors are wrong.
7. Difficulty level: ${difficulty}.
8. Never ask meta questions about the cards themselves (e.g. "What did Card 2 say?"). Ask direct subject questions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Generate ${requestedCount} multiple choice questions based on this study content:\n\n${promptContext}`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.25,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Array of exactly 4 answer options',
              },
              correctAnswerIndex: {
                type: Type.INTEGER,
                description: '0-based index of correct option (0, 1, 2, or 3)',
              },
              explanation: { type: Type.STRING, description: 'Detailed explanation of correct answer' },
              sourceReference: { type: Type.STRING, description: 'Topic or concept reference' },
            },
            required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
          },
        },
      },
    });

    const rawText = response.text || '[]';
    let questions = [];
    try {
      questions = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Quiz JSON from Gemini');
      }
    }

    const validatedQuestions = questions
      .filter((q: any) => Array.isArray(q.options) && q.options.length === 4 && typeof q.correctAnswerIndex === 'number')
      .map((q: any, i: number) => ({
        id: q.id || `quiz-q-${Date.now()}-${i}`,
        question: q.question,
        options: q.options,
        correctAnswerIndex: Math.min(Math.max(q.correctAnswerIndex, 0), 3),
        explanation: q.explanation || 'Verified correct from study material.',
        sourceReference: q.sourceReference || subject,
      }));

    if (validatedQuestions.length === 0) {
      return res.status(502).json({
        error: 'Could not generate valid quiz questions from the selected deck. Please try with more flashcards.',
      });
    }

    res.json({
      success: true,
      questions: validatedQuestions,
      count: validatedQuestions.length,
      deckTitle,
      subject,
    });
  } catch (err: any) {
    console.error('Error generating quiz with Gemini:', err);
    res.status(500).json({
      error: err?.message || 'Failed to generate quiz. Please check server logs.',
    });
  }
});

// Mount Vite middleware in development mode, or static file serving in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

// Start Express HTTP server listening on port 3000
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`RecallMate AI server listening on http://0.0.0.0:${PORT}`);
});
