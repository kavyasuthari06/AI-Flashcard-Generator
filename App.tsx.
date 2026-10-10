/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { Dashboard } from './components/dashboard/Dashboard';
import { CreateDeck } from './components/create/CreateDeck';
import { StudyView } from './components/study/StudyView';
import { QuizView } from './components/quiz/QuizView';
import { DecksList } from './components/decks/DecksList';
import { ProgressView } from './components/progress/ProgressView';
import { Deck, Flashcard, QuizAttempt, RecallRating } from './types';
import {
  initializeStorage,
  getDecks,
  saveDeck,
  deleteDeck as removeDeckFromStorage,
  deleteCardsFromDeck,
  updateCardRecallRating,
  getQuizHistory,
  saveQuizAttempt,
  getDueRevisionCards,
  computeStats,
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Quick upload transfer state
  const [preloadedContent, setPreloadedContent] = useState<string>('');
  const [preloadedTitle, setPreloadedTitle] = useState<string>('');
  const [preloadedSubject, setPreloadedSubject] = useState<string>('');
  const [preloadedMode, setPreloadedMode] = useState<'topic' | 'pdf' | 'paste'>('topic');

  // Initial load
  useEffect(() => {
    initializeStorage();
    refreshAllData();
  }, []);

  const refreshAllData = () => {
    const loadedDecks = getDecks();
    setDecks(loadedDecks);
    setQuizHistory(getQuizHistory());
  };

  const stats = computeStats();
  const dueCards = getDueRevisionCards();

  // Navigation handlers
  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open deck for study
  const handleOpenDeck = (deck: Deck) => {
    setActiveDeck(deck);
    setActiveTab('study');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Start quiz on a deck
  const handleStartQuiz = (deck: Deck) => {
    setActiveDeck(deck);
    setActiveTab('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Quick upload from dashboard
  const handleQuickUpload = (
    text: string,
    title?: string,
    subject?: string,
    mode?: 'topic' | 'pdf' | 'paste'
  ) => {
    setPreloadedContent(text);
    setPreloadedTitle(title || '');
    setPreloadedSubject(subject || '');
    setPreloadedMode(mode || (text.length > 50 ? 'paste' : 'topic'));
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated "Revise Due Cards" mode
  const handleStartDueSession = () => {
    if (dueCards.length === 0) return;
    const dueDeck: Deck = {
      id: `due-session-${Date.now()}`,
      title: `Today's Priority Revision (${dueCards.length} Cards)`,
      subject: 'Recall Meter Priority',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      difficulty: 'Intermediate',
      cards: dueCards.map((dc) => dc.card),
    };
    setActiveDeck(dueDeck);
    setActiveTab('study');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Deck Created Handler
  const handleDeckCreated = (deckData: {
    title: string;
    subject: string;
    difficulty: any;
    cardTypeMode?: any;
    cards: Flashcard[];
    sourceText: string;
    sourceFileName?: string;
    sourceTopic?: string;
  }) => {
    const newDeck: Deck = {
      id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: deckData.title,
      subject: deckData.subject,
      difficulty: deckData.difficulty,
      cardTypeMode: deckData.cardTypeMode,
      cards: deckData.cards,
      sourceText: deckData.sourceText,
      sourceFileName: deckData.sourceFileName,
      sourceTopic: deckData.sourceTopic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastStudiedAt: null,
    };

    saveDeck(newDeck);
    refreshAllData();
    // Open the new deck in study mode right away
    setActiveDeck(newDeck);
    setActiveTab('study');
    // Clear preload states
    setPreloadedContent('');
    setPreloadedTitle('');
    setPreloadedSubject('');
    setPreloadedMode('topic');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save updated deck (card edits, additions, deletions)
  const handleSaveDeck = (updatedDeck: Deck) => {
    saveDeck(updatedDeck);
    refreshAllData();
    setActiveDeck(updatedDeck);
  };

  // Rename deck
  const handleRenameDeck = (deckId: string, newTitle: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (deck) {
      const updated = { ...deck, title: newTitle };
      saveDeck(updated);
      refreshAllData();
    }
  };

  // Delete deck
  const handleDeleteDeck = (deckId: string) => {
    removeDeckFromStorage(deckId);
    refreshAllData();
    if (activeDeck?.id === deckId) {
      setActiveDeck(null);
    }
  };

  // Recall Meter rating handler
  const handleRateRecall = (deckId: string, cardId: string, rating: RecallRating) => {
    updateCardRecallRating(deckId, cardId, rating);
    refreshAllData();
  };

  // Card deletion handler for DecksList
  const handleDeleteCardsFromDeck = (deckId: string, cardIds: string[]) => {
    deleteCardsFromDeck(deckId, cardIds);
    refreshAllData();
  };

  // Quiz Attempt Saved
  const handleSaveQuizAttempt = (attempt: QuizAttempt) => {
    saveQuizAttempt(attempt);
    refreshAllData();
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased">
      {/* Persistent Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar activeTab={activeTab} onNavigate={handleNavigate} stats={stats} />
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 bg-slate-900 flex flex-col h-full shadow-2xl">
            <Sidebar
              activeTab={activeTab}
              onNavigate={(tab) => {
                handleNavigate(tab);
                setIsMobileMenuOpen(false);
              }}
              stats={stats}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          stats={stats}
          onStartDueRevision={dueCards.length > 0 ? handleStartDueSession : undefined}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              decks={decks}
              dueCards={dueCards}
              onNavigate={handleNavigate}
              onOpenDeck={handleOpenDeck}
              onStartQuiz={handleStartQuiz}
              onQuickUpload={handleQuickUpload}
              onStartDueSession={handleStartDueSession}
            />
          )}

          {activeTab === 'create' && (
            <CreateDeck
              initialContent={preloadedContent}
              initialTitle={preloadedTitle}
              initialSubject={preloadedSubject}
              initialMode={preloadedMode}
              onDeckCreated={handleDeckCreated}
              onCancel={() => handleNavigate('dashboard')}
            />
          )}

          {activeTab === 'study' && activeDeck && (
            <StudyView
              deck={activeDeck}
              onSaveDeck={handleSaveDeck}
              onRateRecall={handleRateRecall}
              onStartQuiz={handleStartQuiz}
              onBack={() => handleNavigate('decks')}
            />
          )}

          {activeTab === 'study' && !activeDeck && (
            <div className="max-w-md mx-auto text-center py-16">
              <h3 className="text-lg font-bold text-slate-800">No active deck selected</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Choose a deck from your library or create a new one.
              </p>
              <button
                onClick={() => handleNavigate('decks')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-sm text-xs font-semibold cursor-pointer"
              >
                Go to My Decks
              </button>
            </div>
          )}

          {activeTab === 'quiz' && (
            <QuizView
              decks={decks}
              selectedDeck={activeDeck}
              onSaveQuizAttempt={handleSaveQuizAttempt}
              onStudyDeck={handleOpenDeck}
              onBackToDashboard={() => handleNavigate('dashboard')}
            />
          )}

          {activeTab === 'decks' && (
            <DecksList
              decks={decks}
              onOpenDeck={handleOpenDeck}
              onStartQuiz={handleStartQuiz}
              onRenameDeck={handleRenameDeck}
              onDeleteDeck={handleDeleteDeck}
              onDeleteCardsFromDeck={handleDeleteCardsFromDeck}
              onRecategorizeCard={handleRateRecall}
              onCreateNew={() => handleNavigate('create')}
            />
          )}

          {activeTab === 'progress' && (
            <ProgressView
              stats={stats}
              decks={decks}
              quizHistory={quizHistory}
              onResetData={refreshAllData}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>
    </div>
  );
}
