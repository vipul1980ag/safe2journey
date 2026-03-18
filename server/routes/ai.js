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

// POST /api/ai/chat — conversational AI assistant
router.post('/chat', async (req, res) => {
  const { messages, context } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const systemWithContext = context
      ? `${SYSTEM_PROMPT}\n\nUser's current journey context:\n${JSON.stringify(context, null, 2)}`
      : SYSTEM_PROMPT;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemWithContext,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    res.json({ reply: response.content[0].text });
  } catch (e) {
    console.error('[ai/chat]', e.message);
    const msg = e.status === 401
      ? 'Invalid API key. Set ANTHROPIC_API_KEY in server environment.'
      : 'AI service temporarily unavailable.';
    res.status(500).json({ error: msg });
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
