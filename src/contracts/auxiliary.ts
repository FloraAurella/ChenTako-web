/** Auxiliary requests contain no chat history for title generation. */
export const AUXILIARY_CHAT_ROUTES = Object.freeze({ title: '/api/chat/title', compress: '/api/chat/compress' });
export interface AuxiliaryModelSelection { providerId: string; model: string }
export interface TitleRequest {
  provider: { id: string; displayName: string; baseUrl: string; responseFormat: string };
  model: string;
  input: string;
}
export interface TitleResponse { ok: true; title: string }
