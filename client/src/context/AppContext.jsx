import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Subjects
  const [subjects, setSubjects] = useState(() => {
    const saved = localStorage.getItem('subjects');
    return saved ? JSON.parse(saved) : ['General'];
  });

  // Active subject filter
  const [activeSubject, setActiveSubject] = useState('All');

  // Notes storage
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('notes');
    return saved ? JSON.parse(saved) : [];
  });

  // Active tab
  const [activeTab, setActiveTab] = useState('library');

  // Handle theme changes
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Persist subjects
  useEffect(() => {
    localStorage.setItem('subjects', JSON.stringify(subjects));
  }, [subjects]);

  // Persist notes
  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  const addSubject = (subject) => {
    if (subject && !subjects.includes(subject)) {
      setSubjects([...subjects, subject]);
    }
  };

  const removeSubject = (subject) => {
    if (subject !== 'General') {
      setSubjects(subjects.filter(s => s !== subject));
      if (activeSubject === subject) setActiveSubject('All');
    }
  };

  const addNote = (note) => {
    setNotes([{ ...note, id: Date.now(), createdAt: new Date().toISOString() }, ...notes]);
  };

  const getFilteredNotes = () => {
    if (activeSubject === 'All') return notes;
    return notes.filter(n => n.subject === activeSubject);
  };

  const getAllNotesText = () => {
    const filtered = getFilteredNotes();
    return filtered.map(n => n.text).join('\n\n');
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <AppContext.Provider value={{
      darkMode,
      toggleDarkMode,
      subjects,
      addSubject,
      removeSubject,
      activeSubject,
      setActiveSubject,
      notes,
      addNote,
      getFilteredNotes,
      getAllNotesText,
      activeTab,
      setActiveTab,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
