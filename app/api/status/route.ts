export const dynamic = "force-dynamic";

// Lets the UI show a setup hint when no API key is configured. Other
// credential sources (an `ant auth login` profile, for example) also work,
// so this is a hint, not a gate.
export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return Response.json({ configured, model: process.env.AGENT_MODEL || "claude-opus-5-5" });
}
