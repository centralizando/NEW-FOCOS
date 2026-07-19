import React, { useState, useEffect, useRef } from "react";
import { 
  Check, 
  Plus, 
  Trash, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  Target, 
  Database, 
  AlertTriangle, 
  RefreshCw, 
  Sliders, 
  Tag, 
  ChevronRight, 
  Info, 
  ListTodo, 
  ArrowRight,
  Flame,
  Award,
  Sparkles,
  Briefcase,
  Home
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task, Milestone, DbStatus } from "./types";

export default function App() {
  // Global States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>({
    connected: false,
    mode: "fallback",
    error: null
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"hoje" | "todas" | "novo">("hoje");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
  });
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Form States for creating task
  const [taskName, setTaskName] = useState("");
  const [taskCategory, setTaskCategory] = useState("Estudos");
  const [dueDate, setDueDate] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [customMilestones, setCustomMilestones] = useState<{
    date_string: string;
    label: string;
    target_progress: number;
    description: string;
  }[]>([]);

  // Local Time & Date Info
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getDayOfWeekName = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "long" }).split("-")[0];
  };

  // Fetch all tasks and DB Status
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch DB Status
      const dbRes = await fetch("/api/db-status");
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDbStatus(dbData);
      }

      // 2. Fetch Tasks
      const tasksRes = await fetch("/api/tasks");
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
        // Sync with LocalStorage if in fallback mode
        if (dbStatus.mode === "fallback") {
          localStorage.setItem("foco_tasks_backup", JSON.stringify(tasksData));
        }
      } else {
        throw new Error("HTTP error fetching tasks");
      }
    } catch (err) {
      console.error("Connection error, reading from local backup.", err);
      const backup = localStorage.getItem("foco_tasks_backup");
      if (backup) {
        setTasks(JSON.parse(backup));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Attempt database reconnection
  const handleReconnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/db-reconnect", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        if (data.connected) {
          // Toast or message
          fetchData();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate provisional milestones based on due date
  useEffect(() => {
    if (!dueDate || !autoGenerate) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    const targetDate = new Date(dueDate + "T12:00:00");
    targetDate.setHours(0,0,0,0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      // Due today or in the past
      setCustomMilestones([
        {
          date_string: dueDate,
          label: "Entrega",
          target_progress: 100,
          description: "Entregar a tarefa hoje!"
        }
      ]);
      return;
    }

    const newMs = [];
    
    // Timezone-safe local YYYY-MM-DD generator
    const getLocalYYYYMMDD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (diffDays === 1) {
      // Special case: due tomorrow. Create today's 100% milestone and tomorrow's delivery milestone.
      const todayStr = getLocalYYYYMMDD(today);
      const tomorrowStr = dueDate;
      
      const dayNameTomorrow = getDayOfWeekName(tomorrowStr);
      const capitalizedTomorrow = dayNameTomorrow.charAt(0).toUpperCase() + dayNameTomorrow.slice(1);

      newMs.push({
        date_string: todayStr,
        label: "Hoje (Pronta!)",
        target_progress: 100,
        description: `Deixar a tarefa de ${taskName || "..."} 100% pronta (um dia antes da entrega)`
      });

      newMs.push({
        date_string: tomorrowStr,
        label: `Meta ${capitalizedTomorrow} (Entrega)`,
        target_progress: 100,
        description: `Entrega oficial de ${taskName || "..."}`
      });
    } else {
      // General case: 2 or more days until due date.
      // We reach 100% at (diffDays - 1) days from today.
      for (let i = 1; i <= diffDays; i++) {
        const currentMsDate = new Date(today);
        currentMsDate.setDate(today.getDate() + i);
        const dateString = getLocalYYYYMMDD(currentMsDate);
        
        const dayName = getDayOfWeekName(dateString);
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        if (i === diffDays) {
          // Delivery Day
          newMs.push({
            date_string: dateString,
            label: `Meta ${capitalizedDay} (Entrega)`,
            target_progress: 100,
            description: `Entrega oficial de ${taskName || "..."}`
          });
        } else if (i === diffDays - 1) {
          // One Day Before Delivery Day (Pronta!)
          newMs.push({
            date_string: dateString,
            label: `Meta ${capitalizedDay} (Pronta!)`,
            target_progress: 100,
            description: `Deixar a tarefa de ${taskName || "..."} 100% pronta (um dia antes da entrega)`
          });
        } else {
          // Progressive steps scaling up to 100% at (diffDays - 1)
          const progressFraction = Math.round((i / (diffDays - 1)) * 100);
          newMs.push({
            date_string: dateString,
            label: `Meta ${capitalizedDay}`,
            target_progress: progressFraction,
            description: `Fazer ${progressFraction}% da tarefa de ${taskName || "..."}`
          });
        }
      }
    }
    setCustomMilestones(newMs);
  }, [dueDate, taskName, autoGenerate]);

  // Add a task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName || !dueDate) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: taskName,
          category: taskCategory,
          due_date: dueDate,
          milestones: customMilestones
        })
      });

      if (res.ok) {
        const newTask = await res.json();
        setTasks(prev => {
          const updated = [newTask, ...prev];
          if (dbStatus.mode === "fallback") {
            localStorage.setItem("foco_tasks_backup", JSON.stringify(updated));
          }
          return updated;
        });

        // Reset form
        setTaskName("");
        setDueDate("");
        setCustomMilestones([]);
        setActiveTab("hoje");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete a task
  const handleDeleteTask = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover esta tarefa?")) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTasks(prev => {
          const updated = prev.filter(t => t.id !== id);
          if (dbStatus.mode === "fallback") {
            localStorage.setItem("foco_tasks_backup", JSON.stringify(updated));
          }
          return updated;
        });
        if (selectedTaskId === id) setSelectedTaskId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle/Complete a milestone
  const handleToggleMilestone = async (milestoneId: number, currentCompleted: boolean) => {
    try {
      const res = await fetch(`/api/milestones/${milestoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !currentCompleted })
      });

      if (res.ok) {
        const data = await res.json();
        // Update local tasks state
        setTasks(prev => {
          const updated = prev.map(t => {
            if (t.id === data.task_id) {
              const updatedMilestones = t.milestones?.map(m => {
                if (m.id === milestoneId) {
                  return { ...m, completed: !currentCompleted };
                }
                return m;
              });
              return {
                ...t,
                current_progress: data.new_progress,
                completed: data.completed,
                milestones: updatedMilestones
              };
            }
            return t;
          });

          if (dbStatus.mode === "fallback") {
            localStorage.setItem("foco_tasks_backup", JSON.stringify(updated));
          }
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update milestone location (casa vs trabalho)
  const handleUpdateMilestoneLocation = async (milestoneId: number, newLocation: 'casa' | 'trabalho') => {
    try {
      const res = await fetch(`/api/milestones/${milestoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: newLocation })
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(prev => {
          const updated = prev.map(t => {
            if (t.id === data.task_id) {
              const updatedMilestones = t.milestones?.map(m => {
                if (m.id === milestoneId) {
                  return { ...m, location: newLocation };
                }
                return m;
              });
              return {
                ...t,
                milestones: updatedMilestones
              };
            }
            return t;
          });

          if (dbStatus.mode === "fallback") {
            localStorage.setItem("foco_tasks_backup", JSON.stringify(updated));
          }
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (e: React.DragEvent, milestoneId: number) => {
    e.dataTransfer.setData("text/plain", String(milestoneId));
    setDraggedId(milestoneId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetLocation: 'casa' | 'trabalho') => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData("text/plain") || String(draggedId);
    if (!idStr) return;
    const milestoneId = parseInt(idStr);
    if (isNaN(milestoneId)) return;
    
    await handleUpdateMilestoneLocation(milestoneId, targetLocation);
    setDraggedId(null);
  };

  // Format Date to Friendly Local Format
  const formatDateFriendly = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Helper to get Today's Date String
  const getTodayDateString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
    return localISOTime;
  };

  const todayStr = getTodayDateString();

  // Filter milestones due today/selected day
  const getTodaysMilestones = () => {
    const todays: { milestone: Milestone; taskName: string; category: string }[] = [];
    tasks.forEach(t => {
      if (t.milestones) {
        t.milestones.forEach(m => {
          if (m.date_string === selectedDate) {
            todays.push({
              milestone: m,
              taskName: t.name,
              category: t.category
            });
          }
        });
      }
    });
    return todays;
  };

  const todaysMilestones = getTodaysMilestones();

  // Helper Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const totalMilestonesCount = tasks.reduce((acc, t) => acc + (t.milestones?.length || 0), 0);
  const completedMilestonesCount = tasks.reduce((acc, t) => acc + (t.milestones?.filter(m => m.completed).length || 0), 0);
  const progressRatio = totalMilestonesCount > 0 ? Math.round((completedMilestonesCount / totalMilestonesCount) * 100) : 0;

  // Format current weekday and date in dd/mm/yy format for header subtitle
  const getHeaderDateString = () => {
    const weekday = currentTime.toLocaleDateString("pt-BR", { weekday: "long" });
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    
    const day = String(currentTime.getDate()).padStart(2, "0");
    const month = String(currentTime.getMonth() + 1).padStart(2, "0");
    const year = String(currentTime.getFullYear()).slice(-2);
    
    return `${capitalizedWeekday}, ${day}/${month}/${year}`;
  };

  const headerDateStr = getHeaderDateString();

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-art-cream text-art-dark flex flex-col selection:bg-art-orange selection:text-white font-sans" id="foco-app">
      
      {/* Top Banner (Only if Fallback Mode to keep user informed) */}
      {dbStatus.mode === "fallback" && (
        <div className="bg-amber-100 border-b border-art-dark px-4 sm:px-10 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-amber-900 gap-3" id="fallback-banner">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Modo de Segurança Local Ativo:</strong> Conectando ao banco Neon... Suas metas estão seguras e salvas localmente no navegador por enquanto.
            </span>
          </div>
          <button 
            onClick={handleReconnect}
            disabled={loading}
            className="flex items-center gap-1.5 bg-transparent hover:bg-amber-200 border border-amber-800 text-amber-950 px-3 py-1 text-xs transition-all uppercase tracking-wider font-bold"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Reconectar Banco
          </button>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-art-dark bg-white px-4 sm:px-10 py-5 flex flex-col md:flex-row md:items-center justify-between gap-6" id="header">
        <div className="flex items-center gap-4">
          <div className="bg-art-orange text-white p-3 border border-art-dark shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif italic text-4xl font-extrabold tracking-tight text-art-dark">FOCO</h1>
              <span className="text-[10px] uppercase font-mono tracking-widest bg-art-dark text-white px-2 py-0.5 font-bold">v1.1</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-art-dark tracking-tight mt-1">{headerDateStr}</p>
          </div>
        </div>

        {/* Date, Time & Connection Status */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold uppercase tracking-wider text-art-dark">
              {currentTime.toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {currentTime.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })} UTC-3
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white border border-art-dark p-3 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]" id="db-status-badge">
            <Database className={`w-4 h-4 ${dbStatus.mode === "postgres" ? "text-art-orange" : "text-slate-400"}`} />
            <div className="text-left text-xs">
              <div className="font-bold uppercase tracking-wider text-[10px]">Neon Database</div>
              <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${dbStatus.mode === "postgres" ? "bg-art-orange" : "bg-amber-500 animate-pulse"}`}></span>
                <span className="font-mono text-[10px]">{dbStatus.mode === "postgres" ? "CONECTADO" : "LOCAL SAFE-MODE"}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Summary Bento Section */}
      <section className="px-4 sm:px-10 pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="stats-section">
        
        {/* Total Progress */}
        <div className="bg-white border border-art-dark p-5 shadow-[4px_4px_0px_rgba(26,26,26,1)] flex items-center justify-between relative overflow-hidden group">
          <div className="space-y-1 z-10">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Metas Concluídas</span>
            <h3 className="text-2xl font-black font-serif italic text-art-dark">{completedMilestonesCount} / {totalMilestonesCount}</h3>
            <p className="text-[11px] text-slate-500 font-mono">{progressRatio}% realizado</p>
          </div>
          <div className="relative w-12 h-12 shrink-0 z-10">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-art-gray" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-art-orange transition-all duration-500" strokeWidth="4" strokeDasharray={`${progressRatio}, 100`} strokeLinecap="square" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-art-dark font-bold">
              {progressRatio}%
            </div>
          </div>
        </div>

        {/* Active Tasks */}
        <div className="bg-white border border-art-dark p-5 shadow-[4px_4px_0px_rgba(26,26,26,1)] flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-art-gray border border-art-dark text-art-dark">
            <ListTodo className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Tarefas no Radar</span>
            <h3 className="text-2xl font-black font-serif italic text-art-dark">{totalTasks - completedTasks}</h3>
            <p className="text-[11px] text-slate-500 font-mono">{completedTasks} entregas feitas</p>
          </div>
        </div>

        {/* Today's Focus Ratio */}
        <div className="bg-white border border-art-dark p-5 shadow-[4px_4px_0px_rgba(26,26,26,1)] flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-art-soft-orange border border-art-dark text-art-orange">
            <Flame className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Foco de Hoje</span>
            <h3 className="text-2xl font-black font-serif italic text-art-dark">
              {todaysMilestones.filter(m => m.milestone.completed).length} / {todaysMilestones.length}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              {todaysMilestones.length === 0 ? "Sem metas pendentes" : "micro-metas hoje"}
            </p>
          </div>
        </div>

        {/* XP or Performance Level */}
        <div className="bg-white border border-art-dark p-5 shadow-[4px_4px_0px_rgba(26,26,26,1)] flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-art-gray border border-art-dark text-art-dark">
            <Award className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Produtividade</span>
            <h3 className="text-xl font-black font-serif italic text-art-dark">
              {progressRatio > 80 ? "Altíssima" : progressRatio > 40 ? "Consistente" : totalTasks === 0 ? "Iniciando" : "Regular"}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">Status semanal</p>
          </div>
        </div>

      </section>

      {/* Tab Navigation Menu */}
      <div className="px-4 sm:px-10 pt-8 flex gap-2 border-b border-art-dark overflow-x-auto scrollbar-none flex-nowrap" id="tabs-navigation">
        <button 
          onClick={() => setActiveTab("hoje")}
          className={`px-5 py-3 border-t border-l border-r font-bold text-xs uppercase tracking-wider transition-all relative shrink-0 ${
            activeTab === "hoje" 
              ? "border-art-dark bg-white text-art-dark -mb-[1px] font-black" 
              : "border-transparent text-slate-500 hover:text-art-dark hover:bg-white/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Hoje</span>
            {todaysMilestones.filter(m => !m.milestone.completed).length > 0 && (
              <span className="bg-art-orange text-white text-[9px] font-mono px-1.5 py-0.5">
                {todaysMilestones.filter(m => !m.milestone.completed).length}
              </span>
            )}
          </div>
        </button>

        <button 
          onClick={() => setActiveTab("todas")}
          className={`px-5 py-3 border-t border-l border-r font-bold text-xs uppercase tracking-wider transition-all relative shrink-0 ${
            activeTab === "todas" 
              ? "border-art-dark bg-white text-art-dark -mb-[1px] font-black" 
              : "border-transparent text-slate-500 hover:text-art-dark hover:bg-white/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            <span>Painel de Tarefas</span>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab("novo")}
          className={`px-5 py-3 border-t border-l border-r font-bold text-xs uppercase tracking-wider transition-all relative shrink-0 ${
            activeTab === "novo" 
              ? "border-art-dark bg-white text-art-orange -mb-[1px] font-black" 
              : "border-transparent text-art-orange hover:text-art-orange hover:bg-white/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Novo Planejamento</span>
          </div>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-10" id="main-content">
        <AnimatePresence mode="wait">
          {loading && tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4" id="loading-state">
              <RefreshCw className="w-10 h-10 text-art-orange animate-spin" />
              <p className="text-slate-600 text-xs font-mono uppercase tracking-widest">Carregando seus planos de foco...</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* TAB 1: HOJE (DAILY FOCUS) */}
              {activeTab === "hoje" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="tab-hoje">
                  
                  {/* Left Column: Today's Focus Action */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between border-b border-art-dark pb-3">
                      <div>
                        <h2 className="text-2xl font-serif italic font-bold text-art-dark flex items-center gap-2">
                          {selectedDate === todayStr ? "Metas para Hoje" : "Metas de Foco"}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          {selectedDate === todayStr 
                            ? "Micro-passos planejados para entregar no prazo sem correria" 
                            : `Planejamento de micro-passos para o dia ${formatDateFriendly(selectedDate)}`}
                        </p>
                      </div>
                      <div className="relative flex items-center" id="date-picker-container">
                        <button 
                          onClick={() => {
                            if (dateInputRef.current) {
                              try {
                                dateInputRef.current.showPicker();
                              } catch (err) {
                                try {
                                  dateInputRef.current.click();
                                } catch (clickErr) {
                                  dateInputRef.current.focus();
                                }
                              }
                            }
                          }}
                          className="text-xs bg-white hover:bg-art-soft-orange border border-art-dark px-3 py-1.5 font-mono text-art-dark font-bold shadow-[1px_1px_0px_rgba(26,26,26,1)] hover:shadow-[2px_2px_0px_rgba(26,26,26,1)] flex items-center gap-1.5 transition-all active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none select-none"
                        >
                          <Calendar className="w-3.5 h-3.5 text-art-orange shrink-0" />
                          <span>{formatDateFriendly(selectedDate)}</span>
                          {selectedDate === todayStr && (
                            <span className="ml-1 px-1 bg-art-dark text-white text-[9px] uppercase font-sans font-black tracking-wider leading-none py-0.5">Hoje</span>
                          )}
                        </button>
                        <input 
                          ref={dateInputRef}
                          type="date" 
                          value={selectedDate} 
                          onChange={(e) => {
                            if (e.target.value) {
                              setSelectedDate(e.target.value);
                            }
                          }} 
                          className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                          title="Clique para escolher outro dia"
                        />
                      </div>
                    </div>

                    {todaysMilestones.length === 0 ? (
                      <div className="bg-white border border-dashed border-art-dark p-10 text-center flex flex-col items-center justify-center gap-4">
                        <div className="bg-art-soft-orange p-4 border border-art-dark text-art-orange">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-art-dark uppercase tracking-wider">
                            {selectedDate === todayStr ? "Sem metas para hoje!" : "Sem metas para este dia!"}
                          </p>
                          <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                            {selectedDate === todayStr 
                              ? "Excelente! Que tal criar uma nova tarefa e deixar o FOCO configurar as micro-metas diárias graduais?"
                              : "Nenhuma meta programada para esta data. Use o botão acima para escolher outro dia ou crie uma nova tarefa!"}
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            if (selectedDate !== todayStr) {
                              setSelectedDate(todayStr);
                            } else {
                              setActiveTab("novo");
                            }
                          }}
                          className="text-xs font-bold bg-art-orange hover:bg-art-dark text-white border border-art-dark px-5 py-2.5 uppercase tracking-widest transition"
                        >
                          {selectedDate !== todayStr ? "Voltar para Hoje" : "Planejar Nova Tarefa"}
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* TRABALHO LIST */}
                        <div 
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'trabalho')}
                          className={`p-4 border-2 transition-all duration-200 bg-white min-h-[350px] flex flex-col ${
                            draggedId !== null 
                              ? "border-dashed border-art-orange bg-art-soft-orange/10 scale-[1.01]" 
                              : "border-art-dark bg-[#F2F4F7]"
                          } shadow-[4px_4px_0px_rgba(26,26,26,1)]`}
                        >
                          <div className="flex items-center justify-between mb-4 border-b border-art-dark pb-2">
                            <h3 className="font-serif italic font-bold text-base text-art-dark flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-art-orange shrink-0" />
                              Realizar no Trabalho
                            </h3>
                            <span className="text-xs font-mono bg-art-dark text-white px-2 py-0.5 font-bold">
                              {todaysMilestones.filter(m => m.milestone.location === 'trabalho').length}
                            </span>
                          </div>

                          <div className="space-y-3 flex-1">
                            {todaysMilestones.filter(m => m.milestone.location === 'trabalho').length === 0 ? (
                              <div className="py-12 px-4 text-center border border-dashed border-slate-300 bg-white/70 text-slate-500 text-xs flex flex-col items-center justify-center gap-2 h-full min-h-[200px]">
                                <p className="font-bold">Nada no trabalho hoje</p>
                                <p className="text-[10px] text-slate-400">Arraste uma atividade de hoje para cá ou clique em "Leva pro Trabalho" nos cards de casa.</p>
                              </div>
                            ) : (
                              todaysMilestones
                                .filter(m => m.milestone.location === 'trabalho')
                                .map(({ milestone, taskName, category }) => (
                                  <div 
                                    key={milestone.id}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, milestone.id)}
                                    className={`p-4 border-2 transition-all duration-300 bg-white cursor-grab active:cursor-grabbing group relative ${
                                      milestone.completed 
                                        ? "border-art-dark/40 opacity-60 bg-[#F2F1EA] shadow-none" 
                                        : "border-art-dark shadow-[2px_2px_0px_rgba(26,26,26,1)] hover:shadow-[3px_3px_0px_rgba(26,26,26,1)]"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <button 
                                        onClick={() => handleToggleMilestone(milestone.id, milestone.completed)}
                                        className={`w-6 h-6 border-2 border-art-dark flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                                          milestone.completed 
                                            ? "bg-art-dark text-white" 
                                            : "bg-[#F9F8F3] text-transparent hover:bg-art-soft-orange"
                                        }`}
                                      >
                                        <Check className="w-4 h-4 stroke-[3]" />
                                      </button>

                                      <div className="flex-1 space-y-1.5 min-w-0">
                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                          <span className="text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.2 border border-art-dark bg-[#FFFAF0] text-art-orange">
                                            {category}
                                          </span>
                                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">Tarefa: {taskName}</span>
                                        </div>

                                        <p className={`text-xs font-serif italic font-bold leading-snug transition-all break-words ${milestone.completed ? "text-slate-500 line-through font-normal" : "text-art-dark"}`}>
                                          {milestone.label}: {milestone.description}
                                        </p>

                                        {/* Move Action Button */}
                                        <div className="pt-1 flex items-center justify-between gap-2">
                                          <span className="text-[9px] bg-[#F9F8F3] border border-art-dark px-1.5 py-0.2 font-mono text-art-dark font-bold">
                                            {milestone.target_progress}%
                                          </span>
                                          <button
                                            onClick={() => handleUpdateMilestoneLocation(milestone.id, 'casa')}
                                            title="Mudar para Casa"
                                            className="text-[9px] font-bold font-mono uppercase bg-[#E8F5E9] hover:bg-art-orange hover:text-white border border-art-dark px-2 py-0.5 flex items-center gap-1 transition shadow-[1px_1px_0px_rgba(26,26,26,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                          >
                                            <Home className="w-2.5 h-2.5 text-emerald-700" />
                                            Traz pra Casa
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>

                        {/* CASA LIST */}
                        <div 
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'casa')}
                          className={`p-4 border-2 transition-all duration-200 bg-white min-h-[350px] flex flex-col ${
                            draggedId !== null 
                              ? "border-dashed border-art-orange bg-art-soft-orange/10 scale-[1.01]" 
                              : "border-art-dark bg-[#FAFAFA]"
                          } shadow-[4px_4px_0px_rgba(26,26,26,1)]`}
                        >
                          <div className="flex items-center justify-between mb-4 border-b border-art-dark pb-2">
                            <h3 className="font-serif italic font-bold text-base text-art-dark flex items-center gap-2">
                              <Home className="w-4 h-4 text-art-orange shrink-0" />
                              Realizar em Casa
                            </h3>
                            <span className="text-xs font-mono bg-art-dark text-white px-2 py-0.5 font-bold">
                              {todaysMilestones.filter(m => !m.milestone.location || m.milestone.location === 'casa').length}
                            </span>
                          </div>

                          <div className="space-y-3 flex-1">
                            {todaysMilestones.filter(m => !m.milestone.location || m.milestone.location === 'casa').length === 0 ? (
                              <div className="py-12 px-4 text-center border border-dashed border-slate-300 bg-white/70 text-slate-500 text-xs flex flex-col items-center justify-center gap-2 h-full min-h-[200px]">
                                <p className="font-bold">Nada em casa hoje</p>
                                <p className="text-[10px] text-slate-400">Arraste uma atividade de hoje para cá ou use "Traz pra Casa" nos cards do trabalho.</p>
                              </div>
                            ) : (
                              todaysMilestones
                                .filter(m => !m.milestone.location || m.milestone.location === 'casa')
                                .map(({ milestone, taskName, category }) => (
                                  <div 
                                    key={milestone.id}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, milestone.id)}
                                    className={`p-4 border-2 transition-all duration-300 bg-white cursor-grab active:cursor-grabbing group relative ${
                                      milestone.completed 
                                        ? "border-art-dark/40 opacity-60 bg-[#F2F1EA] shadow-none" 
                                        : "border-art-dark shadow-[2px_2px_0px_rgba(26,26,26,1)] hover:shadow-[3px_3px_0px_rgba(26,26,26,1)]"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <button 
                                        onClick={() => handleToggleMilestone(milestone.id, milestone.completed)}
                                        className={`w-6 h-6 border-2 border-art-dark flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                                          milestone.completed 
                                            ? "bg-art-dark text-white" 
                                            : "bg-[#F9F8F3] text-transparent hover:bg-art-soft-orange"
                                        }`}
                                      >
                                        <Check className="w-4 h-4 stroke-[3]" />
                                      </button>

                                      <div className="flex-1 space-y-1.5 min-w-0">
                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                          <span className="text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.2 border border-art-dark bg-[#FFFAF0] text-art-orange">
                                            {category}
                                          </span>
                                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">Tarefa: {taskName}</span>
                                        </div>

                                        <p className={`text-xs font-serif italic font-bold leading-snug transition-all break-words ${milestone.completed ? "text-slate-500 line-through font-normal" : "text-art-dark"}`}>
                                          {milestone.label}: {milestone.description}
                                        </p>

                                        {/* Move Action Button */}
                                        <div className="pt-1 flex items-center justify-between gap-2">
                                          <span className="text-[9px] bg-[#F9F8F3] border border-art-dark px-1.5 py-0.2 font-mono text-art-dark font-bold">
                                            {milestone.target_progress}%
                                          </span>
                                          <button
                                            onClick={() => handleUpdateMilestoneLocation(milestone.id, 'trabalho')}
                                            title="Mudar para Trabalho"
                                            className="text-[9px] font-bold font-mono uppercase bg-[#FFEFC6] hover:bg-art-orange hover:text-white border border-art-dark px-2 py-0.5 flex items-center gap-1 transition shadow-[1px_1px_0px_rgba(26,26,26,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                          >
                                            <Briefcase className="w-2.5 h-2.5 text-amber-700" />
                                            Leva pro Trabalho
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Right Column: Mini explanation */}
                  <div className="space-y-6">
                    <div className="bg-white border border-art-dark p-6 shadow-[4px_4px_0px_rgba(26,26,26,1)] space-y-4">
                      <h3 className="font-serif italic font-bold text-xl text-art-dark flex items-center gap-2">
                        O Conceito FOCO
                      </h3>
                      <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                        <p>
                          Estudos mostram que realizar grandes trabalhos de uma vez só gera procrastinação. O segredo é o <strong>micro-milestone progressivo</strong>.
                        </p>
                        <p>
                          Como no exemplo da tarefa de inglês entregue na sexta-feira: ao invés de desespero na véspera, você estabelece metas crescentes ao longo da semana (20%, 40%, 80%, 100%).
                        </p>
                        <div className="bg-[#F9F8F3] p-4 border border-art-dark text-[11px] font-mono space-y-1.5 text-art-dark">
                          <div className="text-art-orange font-bold uppercase tracking-wider text-[10px] mb-1">💡 Exemplo Prático:</div>
                          <div>• Segunda: Planejamento inicial</div>
                          <div>• Terça: Meta 20% (Pesquisa)</div>
                          <div>• Quarta: Meta 40% (Escrever rascunho)</div>
                          <div>• Quinta: Meta 80% (Revisão geral)</div>
                          <div>• Sexta: Meta 100% (Entregar!)</div>
                        </div>
                        <p>
                          Dessa forma, todo dia você tem apenas um pequeno passo para cumprir, mantendo a consistência e o foco perfeitos.
                        </p>
                      </div>
                    </div>

                    {/* Quick Stats Summary */}
                    <div className="bg-art-soft-orange border border-art-dark p-6 shadow-[4px_4px_0px_rgba(26,26,26,1)]">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-art-dark">Progresso Semanal</h4>
                      <p className="text-xs text-slate-500 mt-1 font-serif italic">Status de todos os planejamentos ativos</p>
                      
                      <div className="mt-5 space-y-3">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-600 uppercase tracking-widest text-[10px]">Tarefas Entregues</span>
                          <span className="text-art-orange font-bold">{completedTasks} / {totalTasks}</span>
                        </div>
                        <div className="w-full bg-[#EBE9E0] border border-art-dark h-3 overflow-hidden">
                          <div 
                            className="bg-art-orange h-full transition-all duration-500"
                            style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: TODAS AS TAREFAS (PLANEJADOR) */}
              {activeTab === "todas" && (
                <div className="space-y-6" id="tab-todas">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-art-dark pb-3">
                    <div>
                      <h2 className="text-2xl font-serif italic font-bold text-art-dark">
                        Seu Painel de Tarefas
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">Visualize todas as suas entregas programadas, os prazos e veja o progresso de cada micro-marco.</p>
                    </div>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="bg-white border border-dashed border-art-dark rounded-none py-16 text-center flex flex-col items-center justify-center gap-4">
                      <div className="bg-art-gray p-4 border border-art-dark text-art-dark">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-base font-bold uppercase tracking-wider text-art-dark">Nenhum planejamento ativo</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                          Planeje uma tarefa semanal ou mensal para começar a quebrar ela em passos graduais inteligentes.
                        </p>
                      </div>
                      <button 
                        onClick={() => setActiveTab("novo")}
                        className="text-xs font-bold bg-art-orange hover:bg-art-dark text-white border border-art-dark px-5 py-3 uppercase tracking-widest transition"
                      >
                        + Criar Primeiro Planejamento
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                      
                      {/* Left: Tasks List */}
                      <div className="xl:col-span-2 space-y-6">
                        {tasks.map(task => {
                          const isSelected = selectedTaskId === task.id;
                          return (
                            <div 
                              key={task.id}
                              className={`p-6 border transition-all duration-300 bg-white ${
                                task.completed 
                                  ? "border-art-dark bg-[#F2F1EA]" 
                                  : isSelected
                                    ? "border-art-dark shadow-[4px_4px_0px_rgba(26,26,26,1)] ring-1 ring-art-dark"
                                    : "border-art-dark shadow-[3px_3px_0px_rgba(26,26,26,1)] hover:shadow-[4px_4px_0px_rgba(26,26,26,1)]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2 flex-1 cursor-pointer" onClick={() => setSelectedTaskId(isSelected ? null : task.id)}>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 border border-art-dark bg-[#FFFAF0] text-art-orange">
                                      {task.category}
                                    </span>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                                      <Calendar className="w-3.5 h-3.5 text-art-orange" />
                                      <span>Entrega: {formatDateFriendly(task.due_date)}</span>
                                    </div>
                                    {task.completed && (
                                      <span className="text-[9px] font-bold uppercase text-white bg-art-dark px-2 py-0.5 border border-art-dark">
                                        Entregue ✔
                                      </span>
                                    )}
                                  </div>

                                  <h3 className={`text-xl font-serif italic font-bold text-art-dark transition-all ${task.completed ? "text-slate-500 line-through font-normal" : ""}`}>
                                    {task.name}
                                  </h3>
                                </div>

                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
                                  className="p-2 text-slate-400 hover:text-white hover:bg-red-600 border border-transparent hover:border-art-dark transition"
                                  title="Remover Tarefa"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Progress Meter bar */}
                              <div className="mt-5 space-y-1.5 cursor-pointer" onClick={() => setSelectedTaskId(isSelected ? null : task.id)}>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Progresso Atual</span>
                                  <span className="font-mono font-bold text-art-orange">
                                    {task.current_progress}%
                                  </span>
                                </div>
                                <div className="w-full bg-[#EBE9E0] border border-art-dark h-3 overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${
                                      task.completed ? "bg-art-dark" : "bg-art-orange"
                                    }`}
                                    style={{ width: `${task.current_progress}%` }}
                                  ></div>
                                </div>
                              </div>

                              {/* Simple Expand Indicators */}
                              <div 
                                className="mt-4 pt-4 border-t border-art-dark/20 flex items-center justify-between text-xs text-slate-600 cursor-pointer hover:text-art-dark font-mono"
                                onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
                              >
                                <span className="font-bold uppercase tracking-widest text-[10px] text-art-orange hover:underline">
                                  {isSelected ? "Ocultar roadmap" : "Ver metas diárias"}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold bg-[#F9F8F3] px-2 py-0.5 rounded border border-art-dark">
                                    {(task.milestones || []).filter(m => m.completed).length}/{(task.milestones || []).length} metas
                                  </span>
                                  <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isSelected ? "rotate-90 text-art-orange" : ""}`} />
                                </div>
                              </div>

                              {/* Expandable Milestones List inside card */}
                              <AnimatePresence>
                                {isSelected && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden mt-4 pt-4 border-t border-art-dark"
                                  >
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Metas de evolução:</h4>
                                    <div className="relative pl-5 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-art-dark">
                                      {(task.milestones || []).map((ms) => (
                                        <div key={ms.id} className="relative flex items-start gap-4">
                                          {/* Circle Point */}
                                          <button 
                                            onClick={() => handleToggleMilestone(ms.id, ms.completed)}
                                            className={`absolute -left-[18px] w-5 h-5 border-2 border-art-dark flex items-center justify-center transition-all ${
                                              ms.completed 
                                                ? "bg-art-dark text-white scale-110" 
                                                : "bg-white text-transparent hover:bg-art-soft-orange"
                                            }`}
                                          >
                                            {ms.completed && <Check className="w-3.5 h-3.5 stroke-[4]" />}
                                          </button>

                                          <div className="flex-1 min-w-0 bg-[#F9F8F3] p-4 border border-art-dark">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                              <div className="font-bold text-xs text-art-dark uppercase tracking-wider">
                                                {ms.label} <span className="text-slate-500 font-mono font-normal">({formatDateFriendly(ms.date_string)})</span>
                                              </div>
                                              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 border ${ms.completed ? "bg-art-dark text-white border-art-dark" : "bg-white text-art-dark border-art-dark"}`}>
                                                Meta {ms.target_progress}%
                                              </span>
                                            </div>
                                            <p className={`text-xs mt-2 transition-colors font-serif italic ${ms.completed ? "text-slate-400 line-through" : "text-slate-700"}`}>
                                              {ms.description}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Informative Roadmap Sidebar */}
                      <div className="space-y-6">
                        <div className="bg-white border border-art-dark p-6 shadow-[4px_4px_0px_rgba(26,26,26,1)] space-y-4">
                          <div className="flex items-center gap-2 text-art-dark font-bold text-sm uppercase tracking-wider border-b border-art-dark pb-2 font-mono">
                            <Info className="w-4 h-4 text-art-orange" />
                            Guia de Metas
                          </div>
                          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                            <p>
                              Clique em qualquer card de tarefa para abrir o seu <strong>Roadmap de Progresso</strong>.
                            </p>
                            <p>
                              Você pode marcar ou desmarcar marcos diretamente na linha do tempo para atualizar o progresso de cada tarefa em tempo real.
                            </p>
                            <div className="space-y-2.5 mt-3 py-3 border-y border-art-dark/10">
                              <div className="flex items-center gap-2">
                                <span className="w-4 h-4 border border-art-dark bg-art-dark shrink-0"></span>
                                <span className="text-slate-700 font-bold text-[11px] uppercase tracking-wider">Quadrado preto:</span> Meta concluída
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-4 h-4 border border-art-dark bg-white shrink-0"></span>
                                <span className="text-slate-700 font-bold text-[11px] uppercase tracking-wider">Quadrado vazio:</span> Meta pendente
                              </div>
                            </div>
                            <p className="pt-1">
                              O progresso da tarefa se igualará à maior meta concluída, refletindo a sua evolução real em tempo real.
                            </p>
                          </div>
                        </div>

                        {/* Database Sync Information */}
                        <div className="bg-white border border-art-dark p-6 text-xs shadow-[3px_3px_0px_rgba(26,26,26,1)]">
                          <h4 className="font-bold text-[11px] uppercase tracking-widest text-art-dark mb-2 font-mono">Sincronização Neon DB</h4>
                          <p className="text-slate-500 leading-relaxed font-serif italic">
                            Todas as alterações de marcos e novas tarefas criadas são sincronizadas instantaneamente com o servidor do Neon Cloud PostgreSQL. Se a internet falhar ou o banco estiver offline, o app retém os dados localmente no navegador e se sincronizará assim que a conexão for restabelecida.
                          </p>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: NOVO PLANEJAMENTO (CRIAÇÃO) */}
              {activeTab === "novo" && (
                <div className="max-w-3xl mx-auto space-y-6" id="tab-novo">
                  <div className="border-b border-art-dark pb-3">
                    <h2 className="text-2xl font-serif italic font-bold text-art-dark">
                      Criar Novo Planejamento de Metas
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Monte um plano de entrega com micro-marcos graduais automáticos até o dia da entrega final.</p>
                  </div>

                  <form onSubmit={handleCreateTask} className="bg-white border border-art-dark p-6 sm:p-8 shadow-[6px_6px_0px_rgba(26,26,26,1)] space-y-6">
                    
                    {/* Main fields row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest block font-mono">Nome da Tarefa / Entrega</label>
                        <input 
                          type="text" 
                          required
                          value={taskName}
                          onChange={(e) => setTaskName(e.target.value)}
                          placeholder="Ex: Entregar tarefa de Inglês"
                          className="w-full bg-[#F9F8F3] border border-art-dark px-4 py-3 text-sm text-art-dark focus:outline-none focus:ring-2 focus:ring-art-orange font-bold rounded-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest block font-mono">Categoria</label>
                        <select 
                          value={taskCategory}
                          onChange={(e) => setTaskCategory(e.target.value)}
                          className="w-full bg-[#F9F8F3] border border-art-dark px-4 py-3 text-sm text-art-dark focus:outline-none focus:ring-2 focus:ring-art-orange font-bold rounded-none"
                        >
                          <option value="Estudos">Estudos 📚</option>
                          <option value="Trabalho">Trabalho 💼</option>
                          <option value="Pessoal">Pessoal 👤</option>
                          <option value="Projetos">Projetos 🚀</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest block font-mono">Prazo de Entrega (Previsão)</label>
                        <input 
                          type="date" 
                          required
                          min={todayStr}
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full bg-[#F9F8F3] border border-art-dark px-4 py-3 text-sm text-art-dark focus:outline-none focus:ring-2 focus:ring-art-orange font-bold rounded-none"
                        />
                        <p className="text-[10px] text-slate-500 font-serif italic mt-1">As micro-metas serão distribuídas entre hoje e este prazo.</p>
                      </div>

                      <div className="space-y-2 flex flex-col justify-center">
                        <div className="flex items-center gap-3 bg-[#F9F8F3] p-4 border border-art-dark mt-4">
                          <input 
                            type="checkbox" 
                            id="autoGenCheckbox"
                            checked={autoGenerate}
                            onChange={(e) => setAutoGenerate(e.target.checked)}
                            className="w-5 h-5 text-art-orange border-art-dark bg-white focus:ring-art-orange"
                          />
                          <div>
                            <label htmlFor="autoGenCheckbox" className="text-xs font-bold text-art-dark uppercase tracking-wider cursor-pointer flex items-center gap-1.5 font-mono">
                              Auto-Gerar Metas Diárias
                              <Sparkles className="w-3.5 h-3.5 text-art-orange" />
                            </label>
                            <p className="text-[10px] text-slate-500 mt-0.5">Divide o progresso em metas percentuais automáticas para cada dia restante.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pre-calculated Milestones Preview */}
                    {dueDate && (
                      <div className="space-y-4 pt-6 border-t border-art-dark">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-art-dark uppercase tracking-widest font-mono">
                            Visualização dos Micro-Marcos Gerados:
                          </h4>
                          <span className="text-[10px] font-mono font-bold bg-[#F9F8F3] px-2 py-0.5 border border-art-dark">
                            {customMilestones.length} metas diárias
                          </span>
                        </div>

                        <div className="space-y-3">
                          {customMilestones.map((ms, index) => (
                            <div 
                              key={index}
                              className="bg-[#F9F8F3] border border-art-dark p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-[2px_2px_0px_rgba(26,26,26,1)]"
                            >
                              <div className="flex items-center gap-3">
                                <span className="bg-art-orange text-white font-mono font-bold px-2 py-0.5 border border-art-dark text-[10px]">
                                  {ms.target_progress}%
                                </span>
                                <div>
                                  <div className="font-bold text-art-dark uppercase tracking-wider text-[11px]">{ms.label} ({formatDateFriendly(ms.date_string)})</div>
                                  <div className="text-slate-500 text-[11px] font-serif italic mt-0.5">{ms.description}</div>
                                </div>
                              </div>

                              {/* Simple manual adjustment inputs */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <input 
                                  type="text" 
                                  value={ms.description}
                                  onChange={(e) => {
                                    const updated = [...customMilestones];
                                    updated[index].description = e.target.value;
                                    setCustomMilestones(updated);
                                  }}
                                  placeholder="Editar descrição"
                                  className="bg-white border border-art-dark px-2 py-1 text-[11px] text-art-dark w-full sm:w-64 flex-1 min-w-[150px] focus:outline-none focus:border-art-orange rounded-none"
                                />
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    min="0"
                                    max="100"
                                    value={ms.target_progress}
                                    onChange={(e) => {
                                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                      const updated = [...customMilestones];
                                      updated[index].target_progress = val;
                                      setCustomMilestones(updated);
                                    }}
                                    className="bg-white border border-art-dark px-1 py-1 text-[11px] font-mono text-art-orange font-bold w-12 text-center focus:outline-none focus:border-art-orange rounded-none"
                                  />
                                  <span className="text-slate-500 font-mono font-bold">%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-6 border-t border-art-dark flex justify-end">
                      <button 
                        type="submit"
                        disabled={!taskName || !dueDate}
                        className="w-full sm:w-auto bg-art-orange hover:bg-art-dark text-white font-bold px-8 py-4 border border-art-dark hover:border-black transition shadow-[4px_4px_0px_rgba(26,26,26,1)] uppercase tracking-widest text-xs flex items-center justify-center gap-2 rounded-none disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Confirmar e Salvar no FOCO</span>
                      </button>
                    </div>

                  </form>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-art-dark bg-white px-4 sm:px-10 py-6 text-center text-xs text-slate-500 space-y-2 mt-auto" id="footer">
        <p className="font-mono uppercase tracking-wider text-[10px] text-art-dark font-bold">
          <strong>FOCO</strong> — Gerenciador Inteligente de Metas Progressivas. 2026.
        </p>
        <p className="text-[10px] text-slate-500 font-serif italic">
          Desenvolvido com PostgreSQL (Neon Serverless Pooler) e Express para conexões seguras e persistentes.
        </p>
      </footer>

    </div>
  );
}
