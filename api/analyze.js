import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const config = { maxDuration: 300 };

const MAX_CHARS = 150_000;

const SYSTEM = `You are a team-process coach helping a student team leader understand how their team works together.
You receive: computed participation metrics (exact, trust them over your own counting), a meeting transcript, the team charter, and optionally Breakout Learning feedback and individual assessments.

Ground every claim in the course's team-dynamics concepts where they fit:
- Equal turn-taking predicts collective intelligence (Woolley et al., 2010); communication patterns: energy, engagement, exploration (Pentland, 2012).
- Psychological safety and voice (Edmondson): are quieter members' ideas picked up or dropped?
- Hackman's enabling conditions: clear norms of conduct, compelling direction, enabling structure.
- Process loss (Steiner), social loafing (Latane), groupthink and false consensus (Janis), hidden profiles (Stasser & Titus).
- Functional roles (Benne & Sheats): task roles (initiator, information seeker, coordinator, recorder, summarizer), maintenance roles (harmonizer, gatekeeper, encourager), and blocking roles.
- Task vs. relationship conflict (Jehn).

Rules:
- The key value is TEAM-LEVEL synthesis and checking behavior against the team's OWN charter, not grading individuals on course knowledge.
- Quote the transcript verbatim (short quotes) as evidence. Never invent quotes. If evidence for something is absent, say "not observed".
- If Breakout Learning data is provided, compare it with the real meeting (e.g., someone quiet in both settings vs. only in one) and surface team-level signals buried in individual feedback.
- Individual nudges are private: specific, kind, behavioral, one actionable thing for next meeting. No personality diagnoses, no shaming.
- Recommendations must be structural changes a leader can make (process, roles, facilitation techniques), each tied to a concept.
- Be concise. Plain language a busy team leader can read in 3 minutes.`;

const str = { type: "string" };
const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const SCHEMA = obj({
  headline: { ...str, description: "One or two sentence bottom line about how this team works together." },
  team_patterns: {
    type: "array",
    description: "2-5 team-level dynamics, most important first.",
    items: obj({
      title: str,
      evidence: { ...str, description: "Short verbatim quotes and/or metrics." },
      why_it_matters: { ...str, description: "Tie to a named course concept." },
    }),
  },
  charter_check: {
    type: "array",
    description: "Each concrete norm from the charter and whether the meeting showed it.",
    items: obj({
      norm: str,
      status: { type: "string", enum: ["followed", "partly", "not_followed", "not_observed"] },
      evidence: str,
    }),
  },
  roles: {
    type: "array",
    description: "Functional roles each member actually played in the transcript.",
    items: obj({ person: str, roles_observed: { type: "array", items: str }, note: str }),
  },
  role_concentration: { ...str, description: "Is the team over-reliant on one hub? What roles are missing?" },
  actions: {
    type: "array",
    description: "Exactly 3 prioritized structural actions for the leader.",
    items: obj({ action: str, why: str, concept: str }),
  },
  nudges: {
    type: "array",
    description: "One private nudge per member.",
    items: obj({ person: str, strength: str, try_next: str }),
  },
  data_gaps: { ...str, description: "What missing input would sharpen this analysis. Empty string if none." },
});

function block(label, text) {
  return text && text.trim() ? `<${label}>\n${text.trim()}\n</${label}>` : `<${label}>(not provided)</${label}>`;
}

// Uses OpenAI when OPENAI_API_KEY is set, otherwise Claude when ANTHROPIC_API_KEY is set.
async function runOpenAI(user) {
  const client = new OpenAI();
  const resp = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "low" },
    instructions: SYSTEM,
    input: user,
    text: { format: { type: "json_schema", name: "team_debrief", schema: SCHEMA, strict: true } },
  });
  if (resp.status === "incomplete") throw new Error("The debrief was cut off. Try a shorter transcript.");
  return JSON.parse(resp.output_text);
}

async function runClaude(user) {
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined to analyze this input.");
  if (msg.stop_reason === "max_tokens") throw new Error("The debrief was cut off. Try a shorter transcript.");
  return JSON.parse(msg.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const useOpenAI = !!process.env.OPENAI_API_KEY;
  if (!useOpenAI && !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "AI debrief is not configured on this deployment (no API key). The participation metrics above still work." });
  }

  const { metrics, transcript, charter, breakout, assessments } = req.body || {};
  if (!transcript || !transcript.trim()) return res.status(400).json({ error: "A transcript is required." });

  const total = [transcript, charter, breakout, assessments].reduce((n, s) => n + (s ? s.length : 0), 0);
  if (total > MAX_CHARS) {
    return res.status(413).json({ error: `Inputs are ${total.toLocaleString()} characters; the limit is ${MAX_CHARS.toLocaleString()}. Trim the transcript to one meeting or shorten the pasted feedback.` });
  }

  const user = [
    block("computed_metrics", JSON.stringify(metrics, null, 2)),
    block("team_charter", charter),
    block("breakout_learning_feedback", breakout),
    block("individual_assessments", assessments),
    block("meeting_transcript", transcript),
    "Write the team debrief.",
  ].join("\n\n");

  try {
    return res.status(200).json(useOpenAI ? await runOpenAI(user) : await runClaude(user));
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError || err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Rate limited or out of credit. Wait a minute and try again." });
    if (err instanceof OpenAI.AuthenticationError || err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: "The deployment's API key is invalid." });
    if (err instanceof OpenAI.APIError || err instanceof Anthropic.APIError) return res.status(502).json({ error: `AI service error: ${err.message}` });
    if (err instanceof SyntaxError) return res.status(502).json({ error: "The AI returned malformed output. Try again." });
    return res.status(500).json({ error: String(err.message || err) });
  }
}
