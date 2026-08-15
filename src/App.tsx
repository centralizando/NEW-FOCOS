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
import { Task, Milestone, DbStatus, ReviewCheckResult } from "./types";

export default function App() {
  // Global States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>({
    connected: false,
    mode: "fallback",
    error: null
  });
  const [reviewsData, setReviewsData] = useState<ReviewCheckResult | null>(null);
  const [checkingReviews, setCheckingReviews] = useState(false);
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
  const [geralPlanCheck1, setGeralPlanCheck1] = useState(() => localStorage.getItem("plan_geral_1") === "true");
  const [geralPlanCheck2, setGeralPlanCheck2] = useState(() => localStorage.getItem("plan_geral_2") === "true");
  const [geralPlanCheck3, setGeralPlanCheck3] = useState(() => localStorage.getItem("plan_geral_3") === "true");

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
  useEffect(() => {
    localStorage.setItem("plan_geral_1", String(geralPlanCheck1));
  }, [geralPlanCheck1]);
  useEffect(() => {
    localStorage.setItem("plan_geral_2", String(geralPlanCheck2));
  }, [geralPlanCheck2]);
  useEffect(() => {
    localStorage.setItem("plan_geral_3", String(geralPlanCheck3));
  }, [geralPlanCheck3]);

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

  // Fetch serverless review check for GERAL, ENGLISH, LINUX Neon DBs
  const fetchReviewsCheck = async () => {
    setCheckingReviews(true);
    try {
      const res = await fetch("/api/check-reviews");
      if (res.ok) {
        const data = await res.json();
        setReviewsData(data);
      }
    } catch (err) {
      console.error("Error checking reviews across Neon DBs:", err);
    } finally {
      setCheckingReviews(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchReviewsCheck();
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
        {/* Monitor Serverless de Revisões Neon */}
        <div className="bg-white border-2 border-art-dark p-4 shadow-[4px_4px_0px_rgba(26,26,26,1)] max-w-3xl mx-auto space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-art-dark pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-art-orange animate-pulse shrink-0" />
              <h4 className="font-mono font-black text-xs uppercase tracking-wider text-art-dark">
                PERSONAL MONITOR
              </h4>
            </div>
            <button
              onClick={fetchReviewsCheck}
              disabled={checkingReviews}
              className="flex items-center gap-1.5 px-3 py-1 bg-art-dark text-white hover:bg-art-orange transition font-mono text-[11px] font-bold border border-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${checkingReviews ? "animate-spin" : ""}`} />
              <span>{checkingReviews ? "VERIFICANDO..." : "VERIFICAR REVISÕES"}</span>
            </button>
          </div>

          {checkingReviews && !reviewsData && (
            <div className="p-3 bg-slate-50 border border-art-dark text-xs font-mono text-slate-600 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-art-orange" />
              <span>Conectando aos 3 bancos de dados Neon (GERAL, ENGLISH, LINUX)...</span>
            </div>
          )}

          {reviewsData && (
            <div className="space-y-3">
              {/* DB Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                {[
                  { key: 'LINUX', label: 'Linux', url: 'https://gcp-linux.vercel.app/' },
                  { key: 'ENGLISH', label: 'English/AGENDA', url: 'https://tracker-english.vercel.app/' },
                  { key: 'GERAL', label: 'Geral', url: 'https://gbp-notes.vercel.app/' }
                ].map(({ key, label, url }) => {
                  const dbInfo = reviewsData.databases?.[key];
                  const pending = dbInfo?.pendingReviews || 0;
                  const connected = dbInfo?.connected;

                  return (
                    <a 
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-3 border-2 block transition-all hover:-translate-y-0.5 cursor-pointer ${
                        pending > 0 
                          ? "border-amber-600 bg-amber-50/60 hover:bg-amber-100 shadow-[2px_2px_0px_rgba(217,119,6,1)]" 
                          : "border-art-dark bg-[#F8F9FA] hover:bg-white hover:border-art-orange shadow-[2px_2px_0px_rgba(26,26,26,1)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs uppercase text-art-dark">{label}</span>
                        </div>
                        <span 
                          className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                            pending > 0 
                              ? "bg-amber-600 text-white border-amber-800 animate-pulse" 
                              : "bg-emerald-700 text-white border-emerald-900"
                          }`}
                        >
                          {pending > 0 ? `${pending} PENDENTE(S)` : "0 PENDENTES"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className={connected ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                            {connected ? "🟢 Online" : "🔴 Desconectado"}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hack dos Gênios Callout - Grudado diretamente com o Monitor */}
          <div className="bg-art-soft-orange/30 border-t-2 border-art-dark p-3 sm:p-3.5 space-y-2.5 mt-3">
            <p className="text-xs font-mono text-art-dark leading-relaxed">
              <strong className="text-art-orange uppercase tracking-wider font-black">Hack dos Gênios:</strong>{" "}
              Você foca somente em aprender e deixa o computador ficar responsavel em te fazer lembrar de tudo e organizar tudo.
            </p>
            <p className="text-xs font-mono text-art-dark leading-relaxed pt-2.5 border-t border-art-dark/20">
              <strong className="text-art-orange uppercase tracking-wider font-black">Hack dos Gênios:</strong>{" "}
              Entende como funciona, obtenha pequenas vitórias e acume cada vez mais confiança no meu potêncial.
            </p>
          </div>
        </div>

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
                  LINUX
                </h4>
                <div className="flex items-center gap-1.5">
                  {reviewsData?.databases?.LINUX?.pendingReviews ? (
                    <span className="text-[10px] font-mono font-bold bg-amber-600 text-white px-2 py-0.5 animate-pulse border border-amber-800">
                      ⚠️ {reviewsData.databases.LINUX.pendingReviews} REVISÃO(ÕES)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold bg-art-dark text-white px-2 py-0.5">
                      SISTEMA & INFRA
                    </span>
                  )}
                </div>
              </div>

              {/* Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <a 
                  href="https://gcp-linux.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">O que?/Quando revisar?:</span> 
                    <span className="underline font-semibold">clique-aqui</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
                <a 
                  href="https://gbp-notes.vercel.app/?folder=Curso%20Completo%20LINUXTIPS" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">Meu Material:</span> 
                    <span className="underline font-semibold">Fazer-Entrevistas</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
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
                  ENGLISH
                </h4>
                <div className="flex items-center gap-1.5">
                  {reviewsData?.databases?.ENGLISH?.pendingReviews ? (
                    <span className="text-[10px] font-mono font-bold bg-amber-600 text-white px-2 py-0.5 animate-pulse border border-amber-800">
                      ⚠️ {reviewsData.databases.ENGLISH.pendingReviews} REVISÃO(ÕES)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold bg-art-dark text-white px-2 py-0.5">
                      IDIOMAS
                    </span>
                  )}
                </div>
              </div>

              {/* Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <a 
                  href="https://tracker-english.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">O que?/Quando revisar?</span> 
                    <span className="underline font-semibold">clique-aqui</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
                <a 
                  href="https://gp-en-study.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">Meu Material:</span> 
                    <span className="underline font-semibold">textos-em-inglês</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t-2 border-dashed border-art-dark/30"></div>
              <span className="flex-shrink mx-3 font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold">foco contínuo</span>
              <div className="flex-grow border-t-2 border-dashed border-art-dark/30"></div>
            </div>

            {/* GERAL - PLANO */}
            <div className="bg-[#F8F9FA] border-2 border-art-dark p-4 sm:p-5 shadow-[3px_3px_0px_rgba(26,26,26,1)]">
              <div className="flex items-center justify-between border-b-2 border-art-dark pb-2 mb-3">
                <h4 className="font-mono font-black text-sm uppercase tracking-wider text-art-dark flex items-center gap-2">
                  <Target className="w-4 h-4 text-art-orange shrink-0" />
                  GERAL: Trabalho | Casamento | Matheus Class | Peso Confiança
                </h4>
                <div className="flex items-center gap-1.5">
                  {reviewsData?.databases?.GERAL?.pendingReviews ? (
                    <span className="text-[10px] font-mono font-bold bg-amber-600 text-white px-2 py-0.5 animate-pulse border border-amber-800">
                      ⚠️ {reviewsData.databases.GERAL.pendingReviews} REVISÃO(ÕES)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold bg-art-dark text-white px-2 py-0.5">
                      GERAL
                    </span>
                  )}
                </div>
              </div>


              {/* Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <a 
                  href="https://gbp-notes.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-white border border-art-dark hover:bg-art-soft-orange/20 transition font-mono text-art-dark shadow-[1px_1px_0px_rgba(26,26,26,1)]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-art-orange font-bold uppercase text-[10px]">Meu Material:</span> 
                    <span className="underline font-semibold">notas + revisções</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                </a>
              </div>
            </div>

            {/* Link Gráfico de Evolução */}
            <div className="pt-2">
              <a 
                href="https://gb-evolution.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3.5 bg-art-dark hover:bg-art-orange text-white border-2 border-art-dark transition-all duration-200 font-mono shadow-[3px_3px_0px_rgba(26,26,26,1)] hover:shadow-[4px_4px_0px_rgba(26,26,26,1)] active:translate-x-[1px] active:translate-y-[1px] group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-art-orange group-hover:bg-art-dark text-white border border-white/20 transition-colors">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold uppercase tracking-wider">
                      Gráfico de Evolução
                    </span>
                    <span className="block text-[10px] text-slate-300 group-hover:text-white/90 font-sans">
                      gb-evolution.vercel.app
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-white shrink-0 ml-2" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-art-dark bg-white px-4 sm:px-10 py-6 text-center text-xs text-slate-500 space-y-2 mt-12 sm:mt-16" id="footer">
        <p className="font-mono uppercase tracking-wider text-[10px] text-art-dark font-bold">
          <strong>FOCO</strong> — Painel de Foco e Meta Principal. 2026.
        </p>
      </footer>

    </div>
  );
}
