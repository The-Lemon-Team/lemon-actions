import { ArenaActorCard, ArenaVoiceEntry } from '../models/flow.models';

export function cancelVoicePlayback(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/** Проигрывает записанный аудио-войс или озвучивает текст через Web Speech API. */
export function startVoicePlayback(
  voice: ArenaVoiceEntry,
  actor: ArenaActorCard | undefined,
  onEnd: () => void,
): void {
  if (voice.audioDataUrl && typeof Audio !== 'undefined') {
    const audio = new Audio(voice.audioDataUrl);
    audio.onended = onEnd;
    audio.onerror = onEnd;
    audio.play().catch(onEnd);
    return;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(voice.text);
    utterance.lang = 'ru-RU';
    utterance.pitch = actor?.voicePitch ?? 1.0;
    utterance.rate = actor?.voiceRate ?? 1.02;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return;
  }

  setTimeout(onEnd, 3000);
}
