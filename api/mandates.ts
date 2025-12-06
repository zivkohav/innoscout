import { VercelRequest, VercelResponse } from '@vercel/node';
import { Mandate, Answer } from '../src/types';

// In-memory store for demo; replace with database for production
let mandatesStore: Mandate[] = [];
let activeMandateId: string | null = null;

/**
 * Helper: Generate a unique ID (timestamp + random)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handler: List all mandates and return active mandate ID
 */
async function handleList(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    mandates: mandatesStore,
    activeMandateId
  });
}

/**
 * Handler: Create a new mandate
 */
async function handleCreate(req: VercelRequest, res: VercelResponse) {
  const { name, innovationTopic, clarificationAnswers, market, stage, region, setAsActive } = req.body;

  if (!innovationTopic || !name) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'innovationTopic and name are required' });
  }

  const mandate: Mandate = {
    id: generateId(),
    name,
    innovationTopic,
    clarificationAnswers: clarificationAnswers || [],
    refinementRules: [],
    market: market || undefined,
    stage: stage || undefined,
    region: region || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  mandatesStore.push(mandate);

  if (setAsActive || mandatesStore.length === 1) {
    activeMandateId = mandate.id;
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(201).json(mandate);
}

/**
 * Handler: Update a mandate
 */
async function handleUpdate(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const { name, innovationTopic, clarificationAnswers, refinementRules, market, stage, region } = req.body;

  const mandate = mandatesStore.find(m => m.id === id);
  if (!mandate) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({ error: 'Mandate not found' });
  }

  if (name) mandate.name = name;
  if (innovationTopic) mandate.innovationTopic = innovationTopic;
  if (clarificationAnswers) mandate.clarificationAnswers = clarificationAnswers;
  if (refinementRules) mandate.refinementRules = refinementRules;
  if (market) mandate.market = market;
  if (stage) mandate.stage = stage;
  if (region) mandate.region = region;

  mandate.updatedAt = new Date().toISOString();

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(mandate);
}

/**
 * Handler: Delete a mandate
 */
async function handleDelete(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  const index = mandatesStore.findIndex(m => m.id === id);
  if (index === -1) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({ error: 'Mandate not found' });
  }

  mandatesStore.splice(index, 1);

  // If deleted mandate was active, switch to first available or null
  if (activeMandateId === id) {
    activeMandateId = mandatesStore.length > 0 ? mandatesStore[0].id : null;
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ success: true, activeMandateId });
}

/**
 * Handler: Set active mandate
 */
async function handleSetActive(req: VercelRequest, res: VercelResponse) {
  const { mandateId } = req.body;

  const mandate = mandatesStore.find(m => m.id === mandateId);
  if (!mandate) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({ error: 'Mandate not found' });
  }

  activeMandateId = mandateId;

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ success: true, activeMandateId });
}

/**
 * Main handler: Route requests based on method and path
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const method = req.method;
  const path = req.url || '';

  try {
    if (method === 'GET' && path === '/api/mandates') {
      // GET /api/mandates - List all mandates
      await handleList(req, res);
    } else if (method === 'POST' && path === '/api/mandates') {
      // POST /api/mandates - Create new mandate
      await handleCreate(req, res);
    } else if (method === 'PATCH' && path.startsWith('/api/mandates/')) {
      // PATCH /api/mandates/:id - Update mandate
      await handleUpdate(req, res);
    } else if (method === 'DELETE' && path.startsWith('/api/mandates/')) {
      // DELETE /api/mandates/:id - Delete mandate
      await handleDelete(req, res);
    } else if (method === 'POST' && path === '/api/mandates/set-active') {
      // POST /api/mandates/set-active - Set active mandate
      await handleSetActive(req, res);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Mandate endpoint error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: 'Internal server error' });
  }
}
