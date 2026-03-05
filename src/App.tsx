/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Settings, 
  Code, 
  Eye, 
  Download, 
  Send, 
  Trash2, 
  Monitor, 
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Project {
  id: string;
  name: string;
  html: string;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  createdAt: number;
}

interface AppSettings {
  apiUrl: string;
  apiKey: string;
  modelId: string;
}

// --- Constants ---
const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "",
  modelId: "deepseek/deepseek-r1:free"
};

const SYSTEM_PROMPT = `You are an expert web developer. Your task is to create a COMPLETE, Single-File HTML website based on the user's request. 
Output ONLY raw HTML code. Do not include any explanations, markdown code blocks (like \`\`\`html), or preamble. 
The output must start with <!DOCTYPE html> and include all necessary CSS (preferably Tailwind via CDN) and JavaScript within the single file. 
Ensure the design is modern, responsive, and high-quality.`;

export default function App() {
  // --- State ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const currentProject = projects.find(p => p.id === currentProjectId) || null;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Persistence ---
  useEffect(() => {
    const savedProjects = localStorage.getItem('ai_web_builder_projects');
    const savedSettings = localStorage.getItem('ai_web_builder_settings');
    
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects));
      } catch (e) {
        console.error("Failed to parse projects", e);
      }
    }
    
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('ai_web_builder_projects', JSON.stringify(projects));
    }
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('ai_web_builder_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Actions ---
  const createNewProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `Project ${projects.length + 1}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
    <title>New Project</title>
</head>
<body class="bg-slate-900 text-white flex items-center justify-center min-h-screen">
    <div class="text-center">
        <h1 class="text-4xl font-bold mb-4">Your AI Website Starts Here</h1>
        <p class="text-slate-400">Describe what you want in the chat below.</p>
    </div>
</body>
</html>`,
      chatHistory: [],
      createdAt: Date.now()
    };
    setProjects([newProject, ...projects]);
    setCurrentProjectId(newProject.id);
    setViewMode('preview');
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    if (currentProjectId === id) {
      setCurrentProjectId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !currentProjectId || isLoading) return;

    if (!settings.apiKey) {
      setIsSettingsOpen(true);
      alert("Please enter your API Key in settings first.");
      return;
    }

    const userMessage = inputText.trim();
    setInputText('');
    setIsLoading(true);

    const updatedProjects = [...projects];
    const projectIndex = updatedProjects.findIndex(p => p.id === currentProjectId);
    if (projectIndex === -1) return;
    
    const project = updatedProjects[projectIndex];
    const newChatHistory = [...project.chatHistory, { role: 'user' as const, content: userMessage }];
    
    // Optimistic update of chat history
    project.chatHistory = newChatHistory;
    setProjects(updatedProjects);

    try {
      const response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Website Builder'
        },
        body: JSON.stringify({
          model: settings.modelId,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newChatHistory.map(m => ({ role: m.role, content: m.content }))
          ]
        })
      });

      const text = await response.text();
      
      if (!response.ok) {
        alert("API Error: " + text);
        setIsLoading(false);
        return;
      }

      const data = JSON.parse(text);
      const aiResponse = data.choices?.[0]?.message?.content || '';
      
      // Clean up AI response if it wrapped it in markdown blocks
      let cleanHtml = aiResponse.trim();
      if (cleanHtml.includes('```html')) {
        cleanHtml = cleanHtml.split('```html')[1].split('```')[0].trim();
      } else if (cleanHtml.includes('```')) {
        cleanHtml = cleanHtml.split('```')[1].split('```')[0].trim();
      }

      if (cleanHtml) {
        project.html = cleanHtml;
        project.chatHistory = [...newChatHistory, { role: 'assistant', content: aiResponse }];
        setProjects([...updatedProjects]);
      }

    } catch (error) {
      console.error(error);
      alert("Error: " + (error instanceof Error ? error.message : "Failed to connect to AI"));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadHtml = () => {
    if (!currentProject) return;
    const blob = new Blob([currentProject.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name.toLowerCase().replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 font-sans">
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="flex flex-col border-r border-slate-800 bg-slate-900/50 relative overflow-hidden"
      >
        <div className="p-4 flex-shrink-0">
          <button 
            onClick={createNewProject}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-2">
          {projects.map(project => (
            <div 
              key={project.id}
              onClick={() => setCurrentProjectId(project.id)}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                currentProjectId === project.id 
                  ? 'bg-slate-800 text-white shadow-inner' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Globe size={16} className={currentProjectId === project.id ? 'text-blue-400' : 'text-slate-500'} />
                <span className="truncate text-sm font-medium">{project.name}</span>
              </div>
              <button 
                onClick={(e) => deleteProject(project.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 rounded-md text-slate-500 hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-slate-600 text-xs uppercase tracking-widest font-bold">No Projects</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex-shrink-0">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Settings size={18} />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        
        {/* Header */}
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/30 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 transition-colors"
            >
              {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_8px_rgba(234,179,8,0.4)]"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
            </div>
            <h2 className="text-sm font-semibold text-slate-300 ml-2 hidden sm:block truncate max-w-[200px]">
              {currentProject?.name || 'AI Website Builder'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button 
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'preview' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye size={14} />
                <span className="hidden sm:inline">PREVIEW</span>
              </button>
              <button 
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'code' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code size={14} />
                <span className="hidden sm:inline">CODE</span>
              </button>
            </div>
            <button 
              onClick={downloadHtml}
              disabled={!currentProject}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 px-3 py-2 rounded-lg border border-slate-700 transition-all text-xs font-bold"
            >
              <Download size={14} />
              <span className="hidden sm:inline">DOWNLOAD</span>
            </button>
          </div>
        </header>

        {/* Editor/Preview Area */}
        <div className="flex-1 relative overflow-hidden bg-[#0a0a0a]">
          {currentProject ? (
            <AnimatePresence mode="wait">
              {viewMode === 'preview' ? (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full"
                >
                  <iframe 
                    title="Preview"
                    srcDoc={currentProject.html}
                    className="w-full h-full border-none bg-white"
                    sandbox="allow-scripts allow-forms allow-popups"
                  />
                </motion.div>
              ) : (
                <motion.div 
                  key="code"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full overflow-auto p-4 font-mono text-sm text-slate-300 bg-[#0d1117]"
                >
                  <pre className="whitespace-pre-wrap break-all">
                    {currentProject.html}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <div className="p-6 rounded-full bg-slate-900 border border-slate-800">
                <Plus size={48} className="text-slate-700" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-slate-400">No Project Selected</h3>
                <p className="text-sm text-slate-600 mt-1">Create a new project to start building</p>
                <button 
                  onClick={createNewProject}
                  className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-blue-400 font-medium tracking-wide animate-pulse">AI is building your site...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Input */}
        <footer className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
          <div className="max-w-4xl mx-auto relative">
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={currentProjectId ? "Describe your website (e.g., 'A dark portfolio with a contact form')..." : "Create a project first..."}
              disabled={!currentProjectId || isLoading}
              className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-xl py-3 pl-4 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none min-h-[56px] max-h-[200px]"
              rows={1}
            />
            <button 
              onClick={handleSend}
              disabled={!inputText.trim() || !currentProjectId || isLoading}
              className="absolute right-2 bottom-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg transition-all shadow-lg shadow-blue-900/20"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-600 mt-2 uppercase tracking-tighter">
            Powered by OpenRouter • DeepSeek R1
          </p>
        </footer>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Settings size={20} className="text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Settings</h3>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API URL</label>
                  <input 
                    type="text"
                    value={settings.apiUrl}
                    onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Key</label>
                  <input 
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-500">Get your key from <a href="https://openrouter.ai/keys" target="_blank" className="text-blue-400 hover:underline">openrouter.ai</a></p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Model ID</label>
                  <input 
                    type="text"
                    value={settings.modelId}
                    onChange={(e) => setSettings({ ...settings, modelId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-800/50 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-900/20"
                >
                  SAVE CHANGES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
