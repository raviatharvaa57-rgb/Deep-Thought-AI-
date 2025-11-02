import { useState, useEffect, useRef } from 'react';

// FIX: Added type definitions for browser SpeechRecognition API.
// Use `declare global` to augment the global Window interface in a module.
declare global {
  // FIX: Added type definitions for browser SpeechRecognition API
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
  }

  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}


// FIX: Accept a language parameter to be passed to the SpeechRecognition API.
const useSpeechRecognition = (lang: string) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // FIX: With global types declared, we can now safely access these properties without casting to `any`.
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported by this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // FIX: Set the language for the speech recognition instance.
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      if(isListening) {
         // recognition.start(); // This can cause infinite loops if not handled carefully
      }
    };

    recognitionRef.current = recognition;
    // FIX: Add lang to the dependency array to re-initialize recognition if it changes.
  }, [isListening, lang]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return { isListening, transcript, startListening, stopListening };
};

export default useSpeechRecognition;
