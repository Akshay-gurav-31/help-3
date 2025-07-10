import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Mic, MicOff, Send, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// TypeScript interfaces for Speech Recognition
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

// Interfaces for messages and API content
interface Message {
  type: 'ai' | 'user';
  text: string;
  timestamp: Date;
}
interface GoogleGeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}
interface EnhancedAIMentorProps {
  onClose: () => void;
}

export const EnhancedAIMentor = ({ onClose }: EnhancedAIMentorProps) => {
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'ai',
      text: `Hi! I'm your NEXTFAANG AI Mentor, now powered by Team NEXTFAANG ⚡.<br /><br />
<strong>To get started, send your code and include:</strong><br />
- Problem the code solves<br />
- Programming language<br />
- Specific questions or concerns<br />`,
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const speakText = useCallback((text: string) => {
    const cleanedText = text.replace(/<[^>]*>/g, ''); // Remove HTML tags for speech
    if (!cleanedText) return;
    if (synthRef.current && !isSpeaking) {
      synthRef.current.cancel();
      const utter = new SpeechSynthesisUtterance(cleanedText);
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.volume = 0.8;
      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      synthRef.current.speak(utter);
    }
  }, [isSpeaking]);

  const getAIResponse = useCallback(async (userMsg: string, history: Message[]): Promise<string> => {
    // 1. All API keys are now directly in the code.
    const apiKeys = [
      "AIzaSyA1_rsuX11QevyYO-un-Y-5wh0aFIOa9N8",
      "AIzaSyBkAROJX8NNmlInmHcnesyTXWsLCyyza3I",
      "AIzaSyB1g9CZWZRXN3xHJtyngfIWtxLsoUXzMec",
      "AIzaSyB2sUrMy3Nkkghi77ToNJG4bMBOSxMFL6Q",
      "AIzaSyAnRyHaoOFBbB8o42-LwNwW4koELHKxPa8",
      "AIzaSyC45FdgMHFmo_2zQJ7vzHbLcLfdJEElW2c",
      "AIzaSyCqCCByhM_EjK-qp2kVulC9ypKyGd_4FeA",
      "AIzaSyDC_nAR-f7z0ugfzAzFDblf6nPzH5_oa30",
      "AIzaSyBC2U-3xHDY3YNvS0b7O5qb1c6q5ZbQcYw"
    ];

    if (apiKeys.length === 0) {
      return "🚫 No API keys are available.";
    }

    let ruleText = '';
    try {
      const res = await fetch('/rules.txt');
      if (res.ok) {
        ruleText = await res.text();
      }
    } catch (err) {
      console.warn("rules.txt fetch error:", err);
    }

    const lowerQuery = userMsg.toLowerCase();
    const rulesMap: Record<string, string> = {};
    ruleText.split('\n').forEach(line => {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) rulesMap[key.toLowerCase()] = value;
    });

    const intentMatches: [string, string[]][] = [
        ['platformname', ['who are you', 'what is your name', 'platform name']],
        ['contact', ['contact', 'email', 'reach', 'support']],
        ['builtby', ['who built', 'creator', 'founder', 'made this']],
        ['frontend', ['frontend', 'ui built']],
        ['backend', ['backend', 'server']],
        ['ai tools', ['ai tools', 'tech used']],
        ['features', ['features', 'what can you do']],
        ['roadmap', ['roadmap', 'future', 'coming soon']],
    ];

    for (const [key, phrases] of intentMatches) {
        if (phrases.some(p => lowerQuery.includes(p))) {
            if (rulesMap[key]) {
                return `<strong>${key}</strong>: ${rulesMap[key]}`;
            }
        }
    }

    const fullHistory = [...history, { type: 'user', text: userMsg, timestamp: new Date() }];
    const contents: GoogleGeminiContent[] = [
      { role: 'user', parts: [{ text: `Platform Info:\n${ruleText}` }] },
      ...fullHistory.map(msg => ({
        role: msg.type === 'ai' ? 'model' as const : 'user' as const,
        parts: [{ text: msg.text.replace(/<[^>]*>/g, '') }]
      })),
    ];

    // 2. Loop through each API key and try the request
    for (const apiKey of apiKeys) {
      if (!apiKey) continue;

      try {
        console.log(`[Gemini] Trying API key ending with ...${apiKey.slice(-4)}`);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: { temperature: 0.7 }
            })
          }
        );

        if (!res.ok) {
          if (res.status === 429 || res.status === 503) { // Rate limit or Server overloaded
            console.warn(`[Gemini] Key ...${apiKey.slice(-4)} failed (Status: ${res.status}). Switching to the next key.`);
            continue; // Move to the next key
          }
          const errorData = await res.json();
          console.error(`[Gemini] API Error with key ...${apiKey.slice(-4)}:`, errorData);
          return `⚠️ API Error: ${errorData.error?.message || res.statusText}`;
        }

        const data = await res.json();
        console.log(`[Gemini] Success with key ...${apiKey.slice(-4)}`);
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "🤔 No reply.";

      } catch (networkError) {
        console.error(`[Gemini] Network Error with key ...${apiKey.slice(-4)}:`, networkError);
        continue; // Try the next key on network failure
      }
    }

    // This message is returned only if all API keys fail
    console.error("[Gemini] All API keys failed.");
    return "🚫 All AI connections are currently busy. Please try again in a moment.";
  }, []);

  const handleSendMessage = useCallback(async (userText: string) => {
    if (!userText.trim()) return;
    const userMsg: Message = { type: 'user', text: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setCurrentInput('');
    setIsTyping(true);

    const aiText = await getAIResponse(userText, messages);
    const aiMsg: Message = { type: 'ai', text: aiText, timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
    speakText(aiText);
  }, [getAIResponse, messages, speakText]);

  useEffect(() => {
    // Setup speech recognition and synthesis
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SR();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = e.results[0][0].transcript;
        setCurrentInput(transcript);
        setIsListening(false);
        handleSendMessage(transcript);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    synthRef.current = window.speechSynthesis;
    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, [handleSendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
      toast({ title: "🎤 Listening...", description: "Speak now!" });
    }
  };
  
  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };
  const stopSpeaking = () => { synthRef.current?.cancel(); setIsSpeaking(false); };
  const handleClose = () => { setIsOpen(false); onClose(); };

  const quickActions = [
    "Analyze my coding pattern",
    "Suggest today's practice",
    "Contest strategy tips",
    "Mock interview prep",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className="w-96 h-[600px] flex flex-col bg-gradient-to-br from-slate-900/95 to-purple-900/95 border border-purple-500/30 backdrop-blur-lg text-white">
        <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-purple-100">NEXTFAANG</h3>
              <div className="text-xs text-purple-300">AI Mentor • <Badge className="text-green-300 bg-green-700/20">Live</Badge></div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-purple-300 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-lg max-w-[85%] ${msg.type === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                  : 'bg-slate-800 border border-purple-400/10'}`}>
                {msg.type === 'ai'
                  ? <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                  : msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-purple-100 p-3 rounded-lg border border-purple-400/10 flex gap-1">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce" style={{animationDelay: '100ms'}}>•</span>
                <span className="animate-bounce" style={{animationDelay: '200ms'}}>•</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 border-t border-purple-500/20 space-y-2">
          <div className="grid grid-cols-2 gap-2 mb-2">
            {quickActions.map((qa, i) => (
              <Button key={i} variant="outline" size="sm" className="text-xs text-purple-200 hover:bg-purple-700/50"
                onClick={() => handleSendMessage(qa)}>
                {qa}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={currentInput}
              placeholder="Ask me anything..."
              className="text-sm bg-slate-800 border-purple-400/20 text-white focus:ring-purple-500"
              onChange={e => setCurrentInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage(currentInput)}
              disabled={isTyping}
            />
            <Button variant="ghost" size="icon" onClick={isListening ? stopListening : startListening}>
              {isListening ? <MicOff className="h-5 w-5 text-red-400" /> : <Mic className="h-5 w-5 text-purple-400" />}
            </Button>
            <Button onClick={() => handleSendMessage(currentInput)} disabled={isTyping || !currentInput.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
