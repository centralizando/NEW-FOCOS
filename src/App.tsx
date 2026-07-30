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
  Home,
  ExternalLink,
  Terminal,
  Languages
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
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
  });
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Plan Checkbox States
  const [linuxPlanCheck1, setLinuxPlanCheck1] = useState(() => localStorage.getItem("plan_linux_1") === "true");
  const [linuxPlanCheck2, setLinuxPlanCheck2] = useState(() => localStorage.getItem("plan_linux_2") === "true");
  const [linuxPlanCheck3, setLinuxPlanCheck3] = useState(() => localStorage.getItem("plan_linux_3") === "true");
  const [englishPlanCheck1, setEnglishPlanCheck1] = useState(() => localStorage.getItem("plan_eng_1") === "true");
  const [englishPlanCheck2, setEnglishPlanCheck2] = useState(() => localStorage.getItem("plan_eng_2") === "true");
  const [englishPlanCheck3, setEnglishPlanCheck3] = useState(() => localStorage.getItem("plan_eng_3") === "true");

  useEffect(() => {
    localStorage.setItem("plan_linux_1", String(linuxPlanCheck1));
  }, [linuxPlanCheck1]);
  useEffect(() => {
    localStorage.setItem("plan_linux_2", String(linuxPlanCheck2));
  }, [linuxPlanCheck2]);
  useEffect(() => {
    localStorage.setItem("plan_linux_3", String(linuxPlanCheck3));
  }, [linuxPlanCheck3]);
  useEffect(() => {
    localStorage.setItem("plan_eng_1", String(englishPlanCheck1));
  }, [englishPlanCheck1]);
  useEffect(() => {
    localStorage.setItem("plan_eng_2", String(englishPlanCheck2));
  }, [englishPlanCheck2]);
  useEffect(() => {
    localStorage.setItem("plan_eng_3", String(englishPlanCheck3));
  }, [englishPlanCheck3]);

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

  // Update Clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getCountdownToMay2027 = (now: Date) => {
    const target = new Date("2027-05-31T23:59:59");
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { totalDays: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    let days = target.getDate() - now.getDate();
    if (days < 0) {
      months -= 1;
      const lastDayPrevMonth = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
      days += lastDayPrevMonth;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600) % 24;

    return {
      totalDays,
      months: Math.max(0, months),
      days: Math.max(0, days),
      hours,
      minutes,
      seconds
    };
  };

  const countdown = getCountdownToMay2027(currentTime);

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

  // Delete a task directly
  const confirmDeleteTask = async (id: number) => {
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
      console.error("Error deleting task:", err);
    } finally {
      setTaskToDelete(null);
    }
  };

  // Delete a milestone
  const handleDeleteMilestone = async (milestoneId: number) => {
    try {
      const res = await fetch(`/api/milestones/${milestoneId}`, { method: "DELETE" });
      if (res.ok) {
        setTasks(prev => {
          const updated = prev.map(t => {
            if (t.milestones?.some(m => m.id === milestoneId)) {
              return {
                ...t,
                milestones: t.milestones.filter(m => m.id !== milestoneId)
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
      console.error("Error deleting milestone:", err);
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

  // Reschedule milestone to the next day
  const getNextDateString = (dateStr: string) => {
    const parts = dateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handlePostponeMilestone = async (milestoneId: number, currentDateStr: string) => {
    try {
      const nextDateStr = getNextDateString(currentDateStr);
      const res = await fetch(`/api/milestones/${milestoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_string: nextDateStr })
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(prev => {
          const updated = prev.map(t => {
            if (t.id === data.task_id) {
              const updatedMilestones = t.milestones?.map(m => {
                if (m.id === milestoneId) {
                  return { ...m, date_string: nextDateStr };
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


        </div>
      </header>

      {/* Video Section */}
      <section className="px-4 sm:px-10 pt-8 space-y-6" id="stats-section">
        {/* Video 1 */}
        <div className="bg-white border border-art-dark p-3 sm:p-4 shadow-[4px_4px_0px_rgba(26,26,26,1)] max-w-3xl mx-auto flex flex-col items-center justify-center">
          
          {/* Meta Principal • Maio 2027 Panel */}
          <div className="w-full mb-5 pb-5 border-b-2 border-art-dark space-y-4 text-left">
            <div className="bg-[#FAF9F5] border-2 border-art-dark p-4 sm:p-5 shadow-[3px_3px_0px_rgba(26,26,26,1)] space-y-4">
              
              {/* Header Badge & Deadline */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-art-dark pb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-art-dark text-white font-mono text-xs font-black px-2.5 py-1 uppercase tracking-wider flex items-center gap-1.5 shadow-[1px_1px_0px_rgba(0,0,0,0.2)]">
                    <Target className="w-3.5 h-3.5 text-art-orange" />
                    Meta Principal • Maio 2027
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-art-orange bg-white border border-art-dark px-2.5 py-1 shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Prazo Final: Maio/2027</span>
                </div>
              </div>

              {/* Fundamental Elements */}
              <div className="space-y-2.5">
                <h4 className="font-serif italic font-bold text-sm sm:text-base text-art-dark">
                  Esses 2 elementos fundamentais para destravar todas BENÇÃOS
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-white border-2 border-art-dark p-3 flex items-start gap-2.5 shadow-[2px_2px_0px_rgba(26,26,26,1)]">
                    <div className="w-5 h-5 rounded-full bg-art-dark text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <span className="text-xs font-mono font-bold text-art-dark leading-tight">
                      Entender inglês e falar muito bem
                    </span>
                  </div>
                  <div className="bg-white border-2 border-art-dark p-3 flex items-start gap-2.5 shadow-[2px_2px_0px_rgba(26,26,26,1)]">
                    <div className="w-5 h-5 rounded-full bg-art-dark text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <span className="text-xs font-mono font-bold text-art-dark leading-tight">
                      Fazer e praticar todos os projetos e aulas LINUXTIPS
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Countdown Box */}
              <div className="bg-white border-2 border-art-dark p-4 space-y-3 shadow-[2px_2px_0px_rgba(26,26,26,1)]">
                <div className="flex items-center justify-between border-b border-art-dark/20 pb-2">
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-art-dark flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-art-orange animate-pulse" />
                    Tempo Restante
                  </span>
                  <span className="font-mono text-[11px] font-black bg-art-soft-orange text-art-dark border border-art-dark px-2 py-0.5 uppercase tracking-wider">
                    {countdown.totalDays} DIAS TOTAIS
                  </span>
                </div>

                {/* Countdown Digit Blocks */}
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                  <div className="bg-[#F8F9FA] border border-art-dark p-1.5 sm:p-2 shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                    <div className="font-mono font-black text-base sm:text-xl text-art-dark">
                      {String(countdown.months).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-slate-500">
                      Meses
                    </div>
                  </div>
                  <div className="bg-[#F8F9FA] border border-art-dark p-1.5 sm:p-2 shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                    <div className="font-mono font-black text-base sm:text-xl text-art-dark">
                      {String(countdown.days).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-slate-500">
                      Dias
                    </div>
                  </div>
                  <div className="bg-[#F8F9FA] border border-art-dark p-1.5 sm:p-2 shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                    <div className="font-mono font-black text-base sm:text-xl text-art-dark">
                      {String(countdown.hours).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-slate-500">
                      Horas
                    </div>
                  </div>
                  <div className="bg-[#F8F9FA] border border-art-dark p-1.5 sm:p-2 shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                    <div className="font-mono font-black text-base sm:text-xl text-art-dark">
                      {String(countdown.minutes).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-slate-500">
                      Min
                    </div>
                  </div>
                  <div className="bg-art-orange text-white border border-art-dark p-1.5 sm:p-2 shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                    <div className="font-mono font-black text-base sm:text-xl">
                      {String(countdown.seconds).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono uppercase font-bold text-white/90">
                      Seg
                    </div>
                  </div>
                </div>

                <div className="text-center pt-1">
                  <p className="font-mono text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Consistência diária até Maio de 2027
                  </p>
                </div>
              </div>

            </div>
          </div>

          <div className="w-full relative overflow-hidden aspect-video border border-art-dark bg-black">
            <iframe 
              src="https://streamable.com/e/lq5cr2?loop=0" 
              className="w-full h-full border-0"
              allow="fullscreen"
              allowFullScreen
              title="Vídeo FOCO 1"
            ></iframe>
          </div>
          <p className="mt-3 text-center font-serif italic text-sm text-slate-700 tracking-wide leading-relaxed">
            "I knew I had to make a change. Step by step, I rebuilt my world. Until I reached the ultimate goal."
          </p>
        </div>

        {/* Video 2 */}
        <div className="bg-white border border-art-dark p-3 sm:p-4 shadow-[4px_4px_0px_rgba(26,26,26,1)] max-w-3xl mx-auto flex flex-col items-center justify-center">
          <div className="w-full relative overflow-hidden aspect-video border border-art-dark bg-black">
            <iframe 
              src="https://streamable.com/e/fttzf3?loop=0" 
              className="w-full h-full border-0"
              allow="fullscreen"
              allowFullScreen
              title="Vídeo FOCO 2"
            ></iframe>
          </div>
          <p className="mt-3 text-center font-serif italic text-sm text-slate-700 tracking-wide leading-relaxed">
            "By balancing Linux and English, I can achieve everything else"
          </p>

          {/* Formatted Plans Section */}
          <div className="w-full mt-6 pt-5 border-t-2 border-art-dark space-y-6 text-left">
            {/* LINUX - PLANO */}
            <div className="bg-[#F8F9FA] border-2 border-art-dark p-4 sm:p-5 shadow-[3px_3px_0px_rgba(26,26,26,1)]">
              <div className="flex items-center justify-between border-b-2 border-art-dark pb-2 mb-3">
                <h4 className="font-mono font-black text-sm uppercase tracking-wider text-art-dark flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-art-orange shrink-0" />
                  LINUX - PLANO
                </h4>
                <span className="text-[10px] font-mono font-bold bg-art-dark text-white px-2 py-0.5">
                  SISTEMA & INFRA
                </span>
              </div>

              {/* Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs">
                <a 
                  href="https://tracker-class.vercel.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">Entrevistas:</span> 
                    <span className="underline font-semibold">tracker-class</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
                <a 
                  href="https://gb-pensamentos.vercel.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">Meu Material:</span> 
                    <span className="underline font-semibold">gb-pensamentos</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
              </div>

              {/* Tasks Checklist */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-2.5 bg-white border border-art-dark cursor-pointer hover:bg-slate-50 transition shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                  <input 
                    type="checkbox" 
                    checked={linuxPlanCheck1}
                    onChange={(e) => setLinuxPlanCheck1(e.target.checked)}
                    className="w-4 h-4 accent-art-orange border-2 border-art-dark rounded-none cursor-pointer shrink-0"
                  />
                  <span className={`text-xs font-mono font-bold transition-all ${linuxPlanCheck1 ? "line-through text-slate-400" : "text-art-dark"}`}>
                    Assistir e Registrar 2 aulas do começo
                  </span>
                </label>
                <label className="flex items-center gap-3 p-2.5 bg-white border border-art-dark cursor-pointer hover:bg-slate-50 transition shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                  <input 
                    type="checkbox" 
                    checked={linuxPlanCheck2}
                    onChange={(e) => setLinuxPlanCheck2(e.target.checked)}
                    className="w-4 h-4 accent-art-orange border-2 border-art-dark rounded-none cursor-pointer shrink-0"
                  />
                  <span className={`text-xs font-mono font-bold transition-all ${linuxPlanCheck2 ? "line-through text-slate-400" : "text-art-dark"}`}>
                    Assistir e Registrar 1 aula da continuação
                  </span>
                </label>
                <label className="flex items-center gap-3 p-2.5 bg-white border border-art-dark cursor-pointer hover:bg-slate-50 transition shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                  <input 
                    type="checkbox" 
                    checked={linuxPlanCheck3}
                    onChange={(e) => setLinuxPlanCheck3(e.target.checked)}
                    className="w-4 h-4 accent-art-orange border-2 border-art-dark rounded-none cursor-pointer shrink-0"
                  />
                  <span className={`text-xs font-mono font-bold transition-all ${linuxPlanCheck3 ? "line-through text-slate-400" : "text-art-dark"}`}>
                    Revisar Entrevistas
                  </span>
                </label>
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t-2 border-dashed border-art-dark/30"></div>
              <span className="flex-shrink mx-3 font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold">foco contínuo</span>
              <div className="flex-grow border-t-2 border-dashed border-art-dark/30"></div>
            </div>

            {/* ENGLISH - PLANO */}
            <div className="bg-[#F8F9FA] border-2 border-art-dark p-4 sm:p-5 shadow-[3px_3px_0px_rgba(26,26,26,1)]">
              <div className="flex items-center justify-between border-b-2 border-art-dark pb-2 mb-3">
                <h4 className="font-mono font-black text-sm uppercase tracking-wider text-art-dark flex items-center gap-2">
                  <Languages className="w-4 h-4 text-art-orange shrink-0" />
                  ENGLISH - PLANO
                </h4>
                <span className="text-[10px] font-mono font-bold bg-art-dark text-white px-2 py-0.5">
                  IDIOMAS
                </span>
              </div>

              {/* Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs">
                <a 
                  href="https://tracker-english.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">Entrevistas:</span> 
                    <span className="underline font-semibold">tracker-english</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
                <a 
                  href="https://drive.google.com/drive/folders/1DRo7lE-Sd_ZpyqKPjZpWuevqcUfzVW77?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">Meu Material:</span> 
                    <span className="underline font-semibold">driver</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
              </div>

              {/* Tasks Checklist */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-2.5 bg-white border border-art-dark cursor-pointer hover:bg-slate-50 transition shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                  <input 
                    type="checkbox" 
                    checked={englishPlanCheck1}
                    onChange={(e) => setEnglishPlanCheck1(e.target.checked)}
                    className="w-4 h-4 accent-art-orange border-2 border-art-dark rounded-none cursor-pointer shrink-0"
                  />
                  <span className={`text-xs font-mono font-bold transition-all ${englishPlanCheck1 ? "line-through text-slate-400" : "text-art-dark"}`}>
                    Fazer tarefa
                  </span>
                </label>
                <label className="flex items-center gap-3 p-2.5 bg-white border border-art-dark cursor-pointer hover:bg-slate-50 transition shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                  <input 
                    type="checkbox" 
                    checked={englishPlanCheck2}
                    onChange={(e) => setEnglishPlanCheck2(e.target.checked)}
                    className="w-4 h-4 accent-art-orange border-2 border-art-dark rounded-none cursor-pointer shrink-0"
                  />
                  <span className={`text-xs font-mono font-bold transition-all ${englishPlanCheck2 ? "line-through text-slate-400" : "text-art-dark"}`}>
                    Revisar Entrevistas
                  </span>
                </label>
                <label className="flex items-center gap-3 p-2.5 bg-white border border-art-dark cursor-pointer hover:bg-slate-50 transition shadow-[1px_1px_0px_rgba(26,26,26,1)]">
                  <input 
                    type="checkbox" 
                    checked={englishPlanCheck3}
                    onChange={(e) => setEnglishPlanCheck3(e.target.checked)}
                    className="w-4 h-4 accent-art-orange border-2 border-art-dark rounded-none cursor-pointer shrink-0"
                  />
                  <span className={`text-xs font-mono font-bold transition-all ${englishPlanCheck3 ? "line-through text-slate-400" : "text-art-dark"}`}>
                    Assistir Cartoons
                  </span>
                </label>
              </div>
            </div>

            {/* Hack dos Gênios Callout */}
            <div className="bg-art-soft-orange/30 border-2 border-art-dark p-3.5 sm:p-4 shadow-[2px_2px_0px_rgba(26,26,26,1)] flex items-start gap-3">
              <p className="text-xs font-mono text-art-dark leading-relaxed">
                <strong className="text-art-orange uppercase tracking-wider font-black">Hack dos Gênios:</strong>{" "}
                <strong>Revisar (Entrevistas)</strong> o <strong>Meu Material</strong> gera motivação extrema — ao revisar aquilo que já domino, consolido o conhecimento e elevo minha confiança e motivação.
              </p>
            </div>
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
                <div className="space-y-6" id="tab-hoje">
                  <div className="flex items-center justify-between border-b border-art-dark pb-3">
                    <div>
                      <h2 className="text-2xl font-serif italic font-bold text-art-dark flex items-center gap-2">
                        {selectedDate === todayStr ? "Foco na Prioridade" : "Metas de Foco"}
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
                    <div className="p-5 border-2 border-art-dark bg-white shadow-[4px_4px_0px_rgba(26,26,26,1)] space-y-4">
                      <div className="flex items-center justify-between border-b border-art-dark pb-2">
                        <h3 className="font-serif italic font-bold text-base text-art-dark flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-art-orange shrink-0" />
                          Lista de Metas
                        </h3>
                        <span className="text-xs font-mono bg-art-dark text-white px-2 py-0.5 font-bold">
                          {todaysMilestones.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {todaysMilestones.map(({ milestone, taskName, category }) => (
                          <div 
                            key={milestone.id}
                            className={`p-4 border-2 transition-all duration-300 bg-white group relative ${
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
                                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">Tarefa: {taskName}</span>
                                </div>

                                <p className={`text-xs font-serif italic font-bold leading-snug transition-all break-words ${milestone.completed ? "text-slate-500 line-through font-normal" : "text-art-dark"}`}>
                                  {milestone.label}: {milestone.description}
                                </p>

                                <div className="pt-1 flex items-center justify-between gap-2">
                                  <span className="text-[9px] bg-[#F9F8F3] border border-art-dark px-1.5 py-0.2 font-mono text-art-dark font-bold">
                                    {milestone.target_progress}%
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handlePostponeMilestone(milestone.id, milestone.date_string)}
                                      title="Levar para o próximo dia"
                                      className="text-[9px] font-bold font-mono uppercase bg-[#E0F2FE] hover:bg-art-orange hover:text-white border border-art-dark px-2 py-0.5 flex items-center gap-1 transition shadow-[1px_1px_0px_rgba(26,26,26,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                    >
                                      <ArrowRight className="w-2.5 h-2.5 text-sky-700" />
                                      Adiar 1 Dia
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMilestone(milestone.id)}
                                      title="Excluir esta meta"
                                      className="text-[9px] font-bold font-mono uppercase bg-red-50 hover:bg-red-600 hover:text-white border border-art-dark px-2 py-0.5 flex items-center gap-1 transition shadow-[1px_1px_0px_rgba(26,26,26,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-red-700"
                                    >
                                      <Trash className="w-2.5 h-2.5" />
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <div className="space-y-6">
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
                                    setTaskToDelete(task);
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
                                              <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 border ${ms.completed ? "bg-art-dark text-white border-art-dark" : "bg-white text-art-dark border-art-dark"}`}>
                                                  Meta {ms.target_progress}%
                                                </span>
                                                <button
                                                  onClick={() => handleDeleteMilestone(ms.id)}
                                                  title="Excluir esta meta"
                                                  className="p-1 text-slate-400 hover:text-red-600 transition"
                                                >
                                                  <Trash className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
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

      </footer>

      {/* Task Deletion Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-art-dark p-6 max-w-md w-full shadow-[6px_6px_0px_rgba(26,26,26,1)] space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <Trash className="w-6 h-6 shrink-0" />
              <h3 className="font-serif italic font-bold text-lg text-art-dark">Excluir Planejamento</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Tem certeza que deseja excluir "<strong>{taskToDelete.name}</strong>"? Esta ação removerá o planejamento e todas as suas metas associadas.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 border border-art-dark text-xs font-mono font-bold hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDeleteTask(taskToDelete.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-bold border border-art-dark transition shadow-[2px_2px_0px_rgba(26,26,26,1)]"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
