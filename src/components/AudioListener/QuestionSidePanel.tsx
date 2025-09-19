import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, HelpCircle } from 'lucide-react';
import { DetectedQuestion, AudioStreamState } from '../../types/audio-stream';

interface QuestionSidePanelProps {
  questions: DetectedQuestion[];
  audioStreamState: AudioStreamState | null;
  onAnswerQuestion: (question: DetectedQuestion, collectionId?: string) => Promise<{ response: string; timestamp: number }>;
  responseMode?: {
    type: "plain" | "qna";
    collectionId?: string;
    collectionName?: string;
  };
  className?: string;
  onClose?: () => void;
}

interface QuestionItemProps {
  question: DetectedQuestion;
  isSelected: boolean;
  onClick: () => void;
}

const QuestionItem: React.FC<QuestionItemProps> = ({ 
  question, 
  isSelected,
  onClick
}) => {
  const refined = (question as any).refinedText as string | undefined;
  const displayText = refined && refined.trim().length > 0 
    ? refined 
    : question.text;

  return (
    <div 
      className={`flex items-center gap-3 p-3 cursor-pointer transition-all rounded-lg ${
        isSelected 
          ? 'bg-green-600/10 border-l-2 border-green-600' 
          : 'hover:bg-white/5'
      }`}
      onClick={onClick}
    >
      <HelpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      <p className="text-xs text-white/90 leading-relaxed">
        {displayText}
      </p>
    </div>
  );
};

const QuestionSidePanel: React.FC<QuestionSidePanelProps> = ({
  questions,
  audioStreamState,
  onAnswerQuestion,
  responseMode = { type: "plain" },
  className = "",
  onClose
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [generatingAnswer, setGeneratingAnswer] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());

  // Filter to only show refined questions
  const refinedQuestions = useMemo(() => {
    const seen = new Set<string>();
    const result: DetectedQuestion[] = [];
    
    for (const q of questions) {
      const refined: string | undefined = (q as any).refinedText;
      // Only include questions that have been refined
      if (refined && refined.trim().length > 0) {
        const norm = refined.toLowerCase().replace(/\s+/g, ' ');
        if (!seen.has(norm)) {
          seen.add(norm);
          result.push(q);
        }
      }
    }
    
    // Sort by timestamp, newest first
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [questions]);

  const handleQuestionClick = async (question: DetectedQuestion) => {
    setSelectedQuestionId(question.id);
    
    // Check if we already have an answer cached
    const cachedAnswer = answers.get(question.id);
    if (cachedAnswer) {
      setCurrentAnswer(cachedAnswer);
      return;
    }

    // Generate new answer
    setGeneratingAnswer(true);
    setCurrentAnswer(null);
    
    try {
      const collectionId = responseMode.type === "qna" ? responseMode.collectionId : undefined;
      const result = await onAnswerQuestion(question, collectionId);
      
      // Cache the answer
      setAnswers(prev => {
        const next = new Map(prev);
        next.set(question.id, result.response);
        return next;
      });
      
      setCurrentAnswer(result.response);
    } catch (error) {
      console.error('Failed to answer question:', error);
      setCurrentAnswer("回答の生成中にエラーが発生しました。");
    } finally {
      setGeneratingAnswer(false);
    }
  };

  const isListening = audioStreamState?.isListening || false;

  if (refinedQuestions.length === 0 && !isListening) {
    return null; // Don't show panel if no questions and not listening
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full morphism-button flex items-center justify-center z-10"
          type="button"
          title="閉じる"
        >
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
      
      {/* Two Panel Layout */}
      <div className="flex gap-2 h-full">
        {/* Left Panel - Questions */}
        <div className="flex-1 liquid-glass chat-container p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-white/90">
              検出された質問
            </span>
            {refinedQuestions.length > 0 && (
              <span className="bg-green-600/20 text-green-300 text-xs px-2 py-0.5 rounded-full">
                {refinedQuestions.length}
              </span>
            )}
            {isListening && (
              <div className="ml-auto flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-emerald-400">リスニング中</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            {refinedQuestions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-8 h-8 text-white/30 mx-auto mb-2" />
                  <p className="text-xs text-white/50">
                    質問を検出中...
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1 overflow-y-auto flex-1">
                {refinedQuestions.map((question) => (
                  <QuestionItem
                    key={question.id}
                    question={question}
                    isSelected={selectedQuestionId === question.id}
                    onClick={() => handleQuestionClick(question)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Answer */}
        <div className="flex-1 liquid-glass chat-container p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <img src="/logo.png" alt="CueMe Logo" className="w-4 h-4" />
            <span className="text-sm font-medium text-white/90">AI回答</span>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            {!selectedQuestionId ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-white/50">
                  左の質問をクリックして回答を表示
                </p>
              </div>
            ) : generatingAnswer ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center">
                  <span className="text-xs text-white/70 mr-2">回答を生成中</span>
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            ) : currentAnswer ? (
              <div className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1">
                {currentAnswer}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-white/50">
                  回答の生成に失敗しました
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionSidePanel;