export type SpeechKind = 'question' | 'excuse';

export function speak(text: string, kind: SpeechKind) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  // Stand-in for the original "onyx" voice: lower and faster for the dramatic exit.
  if (kind === 'excuse') {
    utterance.pitch = 0.8;
    utterance.rate = 1.1;
  }
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  speechSynthesis.cancel();
}
