/**
 * How a call reads in the conversation and in the conversation list.
 *
 * Calls are logged as chat messages whose content is JSON. A group call
 * carries `group: true` (and, once it has ended, how many people were in it),
 * so it reads as one and is not mistaken for a call between two people.
 */
export function callLogLabel(call: { type?: string; group?: boolean; participants?: number }): string {
  const completed = call.type === "video_call_completed";
  if (call.group) {
    if (!completed) return "Missed group video call";
    return call.participants ? `Group video call ended · ${call.participants} people` : "Group video call ended";
  }
  return completed ? "Video call ended" : "Missed video call";
}
