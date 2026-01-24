export async function getCopilotClient() {
  const { CopilotClient } = await import('@github/copilot/sdk');
  return CopilotClient;
}
