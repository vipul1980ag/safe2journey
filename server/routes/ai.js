const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the AI assistant for Safe2Journey, a smart multi-modal journey planning and personal safety app used worldwide.

You help users:
1. Plan journeys using natural language (e.g. "cheapest way from Connaught Place to Gurgaon by 6pm")
2. Understand route options and transport modes (bus, metro, taxi, auto-rickshaw, walking, train, ferry, air)
3. Get safety advice for their journey (time of day, area safety, solo travel tips)
4. Handle disruptions — missed buses, delayed trains, cancelled services
5. Understand app features (safety monitoring, check-ins, parking, emergency alerts)

Safe2Journey features:
- Real-time worldwide route planning using OpenStreetMap data
- Region-adaptive transport (auto-rickshaw in India, tuk-tuk in SE Asia, matatu in Africa, etc.)
- Safety check-ins every 5 min — 3 missed triggers SMS to emergency contact
- Live journey tracking with automatic re-routing on deviation
- Parking suggestions near destination
- Journey history

When a user asks to plan a journey, extract start, end, preferred modes, time constraints.
Tell them what to enter in the Plan Journey tab, or explain how to get the best results.

Be concise, friendly, and practical. No more than 3-4 short paragraphs per response.`;

// POST /api/ai/chat — streaming conversational AI with extended thinking
router.post('/chat', async (req, res) => {
  const { messages, context } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const systemWithContext = context
    ? `${SYSTEM_PROMPT}\n\nUser's current journey context:\n${JSON.stringify(context, null, 2)}`
    : SYSTEM_PROMPT;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Clean up if client disconnects
  let closed = false;
  req.on('close', () => { closed = true; });

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      thinking: { type: 'enabled', budget_tokens: 5000 },
      system: systemWithContext,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (closed) break;

      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'thinking') {
          res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);
        } else if (event.content_block.type === 'text') {
          res.write(`data: ${JSON.stringify({ type: 'text_start' })}\n\n`);
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta' && event.delta.text) {
          res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
        }
      }
    }

    if (!closed) {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  } catch (e) {
    console.error('[ai/chat]', e.message);
    if (!closed) {
      const msg = e.status === 401
        ? 'Invalid API key. Set ANTHROPIC_API_KEY in server environment.'
        : 'AI service temporarily unavailable.';
      res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
      res.end();
    }
  }
});

// POST /api/ai/analyze-route — quick AI safety + value analysis for a route
router.post('/analyze-route', async (req, res) => {
  const { route, startName, endName, timeOfDay } = req.body;
  if (!route || !route.legs) return res.status(400).json({ error: 'route required' });

  const legs = route.legs.map(l =>
    `${l.mode} (${l.distanceKm}km, ${l.durationMins}min, ₹${l.cost})`
  ).join(' → ');

  const prompt = `Analyze this journey for a traveller:
From: ${startName || 'Start'} → To: ${endName || 'Destination'}
Route: ${legs}
Total cost: ₹${route.totalCost} | Total time: ${route.totalDurationMins} min
Time of day: ${timeOfDay || 'daytime'}

Give exactly 3 lines:
1. Safety tip for this specific route combination
2. One practical travel tip (e.g. book ahead, busy hours, comfort)
3. Value verdict: is this good value? (cost vs time vs comfort)`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    res.json({ analysis: response.content[0].text });
  } catch (e) {
    console.error('[ai/analyze-route]', e.message);
    res.status(500).json({ error: 'AI analysis unavailable.' });
  }
});

// POST /api/ai/safety-advice — AI advice for a specific safety situation
router.post('/safety-advice', async (req, res) => {
  const { situation, location, timeOfDay } = req.body;
  if (!situation) return res.status(400).json({ error: 'situation required' });

  const prompt = `A Safe2Journey user needs safety advice:
Situation: ${situation}
Location context: ${location || 'unspecified'}
Time: ${timeOfDay || 'unspecified'}

Give concise, actionable safety advice in 2-3 sentences. Be practical and calm.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    res.json({ advice: response.content[0].text });
  } catch (e) {
    console.error('[ai/safety-advice]', e.message);
    res.status(500).json({ error: 'AI safety advice unavailable.' });
  }
});

module.exports = router;
