# `telegram-voice-transcription` Specification

## Purpose

Voice notes sent to the Telegram bot are downloaded, base64-encoded, and sent to Gemini's multimodal endpoint with a prompt instruction. OpenCode Go (text-only) is not a voice-capable provider; if Gemini is not configured, the bot declines the voice note with a localized message.

## Requirements

### Requirement 1 — Voice download → base64 inline data

When a Telegram update carries a `message.voice` payload, the route handler MUST:

1. Call `https://api.telegram.org/bot{token}/getFile?file_id={voice.file_id}` to get the file path.
2. Download the bytes from `https://api.telegram.org/file/bot{token}/{file_path}`.
3. Base64-encode the audio buffer.
4. Construct a `google.generativeai` `inlineData` part with `data` = base64 string and `mimeType` = `voice.mime_type || 'audio/ogg'`.

- Reference: `src/app/api/telegram/route.ts:619-650`.

### Requirement 2 — Pass inline data to Gemini, not OpenCode

`getAIResponse` MUST accept a non-string input (`{ inlineData: { data, mimeType } }`). When the input is non-string:

- The function MUST attempt Gemini first (requires `process.env.GOOGLE_AI_API_KEY`).
- The function MUST NOT attempt OpenCode.
- The function MUST return a localized error message if Gemini is not configured.

- Reference: `src/app/api/telegram/route.ts:128-145`.

### Requirement 3 — Prompt prefix for transcription

The prompt prefix `Procesá este audio de voz y respondé siguiendo el system prompt.` MUST be sent alongside the inline data, in the form `[{ inlineData }, { text: <prefix> }]`.

- Reference: `src/app/api/telegram/route.ts:135-137`.

### Requirement 4 — Voice errors do not produce 4xx

Voice download / parse errors MUST be reported back to the user as a Telegram message starting with `❌ Hubo un problema al descargar o procesar tu nota de voz: …`. The route MUST still return HTTP 200 to Telegram so the update is not retried.

- Reference: `src/app/api/telegram/route.ts:646-649`.

## Scenarios

### Scenario: Voice → Gemini inline data
- GIVEN a message with a `voice.file_id` and a Gemini key is configured
- WHEN the handler runs
- THEN it calls `getFile`, downloads the bytes, base64-encodes them, and calls `model.generateContent` with an `inlineData` part plus the prompt prefix.

### Scenario: Voice with no Gemini key
- GIVEN a message with a `voice.file_id` and only OpenCode configured
- WHEN the handler runs
- THEN the user receives `⚠️ El procesamiento de voz requiere configurar GOOGLE_AI_API_KEY…` and no download is performed.

### Scenario: `getFile` returns non-200
- GIVEN `getFile` returns non-200
- WHEN the handler runs
- THEN the user receives `❌ Hubo un problema al descargar o procesar tu nota de voz: …` and the route returns HTTP 200.

### Scenario: File download returns non-200
- GIVEN the `/file/bot…` download returns non-200
- WHEN the handler runs
- THEN the user receives the same `❌` error and the route returns HTTP 200.

### Scenario: Default MIME type
- GIVEN `voice.mime_type` is `undefined`
- WHEN the inline data is constructed
- THEN `inlineData.mimeType` is `'audio/ogg'`.

## Out of scope

- Direct STT-only endpoint (the route reuses the AI chat path).
- Voice notes longer than Gemini's per-request size limit (no chunking).
- STT providers other than Gemini multimodal (no Whisper, no local model).
- Speaker identification or diarization.
- Voice message caching (each voice is transcribed on demand).
