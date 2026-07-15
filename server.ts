import express from "express";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

const { Pool } = pg;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Neon DB Connection details - prioritize environment variables for Vercel, fallback to the user's Wispy Fog DB
const dbUrl = process.env.DATABASE_URL || 
              process.env.NEON_DATABASE_URL || 
              "postgresql://neondb_owner:npg_ERaPq9szZ3kp@ep-wispy-fog-at3k4k0x-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

let dbStatus = {
  connected: false,
  mode: "uninitialized" as "postgres" | "fallback" | "uninitialized",
  error: null as string | null
};

let pool: pg.Pool | null = null;

// In-memory fallback database in case the database is offline or misconfigured
interface LocalMilestone {
  id: number;
  task_id: number;
  date_string: string;
  label: string;
  target_progress: number;
  description: string;
  completed: boolean;
}

interface LocalTask {
  id: number;
  name: string;
  category: string;
  due_date: string;
  created_at: string;
  completed: boolean;
  current_progress: number;
  milestones?: LocalMilestone[];
}

let localTasks: LocalTask[] = [
  {
    id: 1,
    name: "Aprender conceitos básicos de Inglês",
    category: "Estudos",
    due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days from now (Friday)
    created_at: new Date().toISOString(),
    completed: false,
    current_progress: 33,
    milestones: [
      { id: 101, task_id: 1, date_string: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], label: "Amanhã", target_progress: 33, description: "Meta Amanhã: fazer 33% da tarefa de inglês", completed: true },
      { id: 102, task_id: 1, date_string: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], label: "Depois de Amanhã", target_progress: 67, description: "Meta Depois de Amanhã: fazer 67% da tarefa de inglês", completed: false },
      { id: 103, task_id: 1, date_string: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], label: "Pronta!", target_progress: 100, description: "Deixar a tarefa de inglês 100% pronta (um dia antes da entrega)", completed: false },
      { id: 104, task_id: 1, date_string: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], label: "Entrega", target_progress: 100, description: "Entrega oficial de aprender conceitos básicos de Inglês", completed: false }
    ]
  }
];
let nextTaskId = 2;
let nextMilestoneId = 200;

let initPromise: Promise<void> | null = null;

async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log("Initializing database connection to Neon PostgreSQL...");
    try {
      if (pool) {
        try { await pool.end(); } catch (e) {}
      }

      pool = new Pool({
        connectionString: dbUrl,
        ssl: {
          rejectUnauthorized: false
        },
        connectionTimeoutMillis: 5000 // 5 seconds timeout
      });

      // Test query
      const client = await pool.connect();
      console.log("Successfully connected to Neon PostgreSQL database!");
      
      // Create tables if they do not exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS foco_tasks (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          due_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed BOOLEAN DEFAULT FALSE,
          current_progress INTEGER DEFAULT 0
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS foco_milestones (
          id SERIAL PRIMARY KEY,
          task_id INTEGER REFERENCES foco_tasks(id) ON DELETE CASCADE,
          date_string VARCHAR(10) NOT NULL,
          label VARCHAR(100) NOT NULL,
          target_progress INTEGER NOT NULL,
          description VARCHAR(255),
          completed BOOLEAN DEFAULT FALSE
        );
      `);

      client.release();
      dbStatus.connected = true;
      dbStatus.mode = "postgres";
      dbStatus.error = null;
      console.log("Database schema initialized and verified.");
    } catch (err: any) {
      console.error("Failed to connect or initialize Neon database. Falling back to local memory storage mode.", err.message);
      dbStatus.connected = false;
      dbStatus.mode = "fallback";
      dbStatus.error = err.message;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

// Auto-reconnect middleware for Serverless environment resilience
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    if (dbStatus.mode === "uninitialized") {
      console.log("Lazy-initializing database connection for path:", req.path);
      await initDatabase();
    }
  }
  next();
});

// API Endpoints

// DB status endpoint
app.get("/api/db-status", (req, res) => {
  res.json(dbStatus);
});

// Re-try database connection
app.post("/api/db-reconnect", async (req, res) => {
  dbStatus.mode = "uninitialized";
  await initDatabase();
  res.json(dbStatus);
});

// GET all tasks (and their milestones)
app.get("/api/tasks", async (req, res) => {
  if (dbStatus.mode === "postgres" && pool) {
    try {
      const tasksResult = await pool.query("SELECT * FROM foco_tasks ORDER BY due_date ASC");
      const tasks = tasksResult.rows;

      const milestonesResult = await pool.query("SELECT * FROM foco_milestones ORDER BY target_progress ASC");
      const milestones = milestonesResult.rows;

      // Map milestones to tasks
      const tasksWithMilestones = tasks.map(task => {
        // format date cleanly for frontend
        const dueDateStr = task.due_date instanceof Date 
          ? task.due_date.toISOString().split('T')[0] 
          : String(task.due_date).split('T')[0];

        return {
          ...task,
          due_date: dueDateStr,
          milestones: milestones
            .filter(m => m.task_id === task.id)
            .map(m => ({
              ...m,
              target_progress: Number(m.target_progress)
            }))
        };
      });

      res.json(tasksWithMilestones);
    } catch (err: any) {
      console.error("DB Error on GET /api/tasks, falling back to local state.", err);
      res.json(localTasks);
    }
  } else {
    res.json(localTasks);
  }
});

// POST create a new task with progressive milestones
app.post("/api/tasks", async (req, res) => {
  const { name, category, due_date, milestones } = req.body;

  if (!name || !category || !due_date) {
    res.status(400).json({ error: "Name, category, and due_date are required fields." });
    return;
  }

  if (dbStatus.mode === "postgres" && pool) {
    try {
      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const taskInsert = await client.query(
          "INSERT INTO foco_tasks (name, category, due_date, completed, current_progress) VALUES ($1, $2, $3, false, 0) RETURNING *",
          [name, category, due_date]
        );
        const newTask = taskInsert.rows[0];

        const insertedMilestones = [];
        if (milestones && Array.isArray(milestones)) {
          for (const ms of milestones) {
            const msInsert = await client.query(
              "INSERT INTO foco_milestones (task_id, date_string, label, target_progress, description, completed) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
              [newTask.id, ms.date_string, ms.label, ms.target_progress, ms.description, ms.completed || false]
            );
            insertedMilestones.push(msInsert.rows[0]);
          }
        }

        await client.query("COMMIT");

        res.status(201).json({
          ...newTask,
          due_date: newTask.due_date instanceof Date ? newTask.due_date.toISOString().split('T')[0] : String(newTask.due_date).split('T')[0],
          milestones: insertedMilestones
        });
      } catch (txnErr) {
        await client.query("ROLLBACK");
        throw txnErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("DB Error on POST /api/tasks, writing to local state.", err);
      // fallback create
      const fallbackTask: LocalTask = {
        id: nextTaskId++,
        name,
        category,
        due_date,
        created_at: new Date().toISOString(),
        completed: false,
        current_progress: 0,
        milestones: (milestones || []).map((ms: any) => ({
          id: nextMilestoneId++,
          task_id: nextTaskId - 1,
          date_string: ms.date_string,
          label: ms.label,
          target_progress: Number(ms.target_progress),
          description: ms.description,
          completed: ms.completed || false
        }))
      };
      localTasks.push(fallbackTask);
      res.status(201).json(fallbackTask);
    }
  } else {
    // strict fallback implementation
    const fallbackTask: LocalTask = {
      id: nextTaskId++,
      name,
      category,
      due_date,
      created_at: new Date().toISOString(),
      completed: false,
      current_progress: 0,
      milestones: (milestones || []).map((ms: any) => ({
        id: nextMilestoneId++,
        task_id: nextTaskId - 1,
        date_string: ms.date_string,
        label: ms.label,
        target_progress: Number(ms.target_progress),
        description: ms.description,
        completed: ms.completed || false
      }))
    };
    localTasks.push(fallbackTask);
    res.status(201).json(fallbackTask);
  }
});

// PUT update a task's details
app.put("/api/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { name, category, due_date, completed, current_progress } = req.body;

  if (dbStatus.mode === "postgres" && pool) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (name !== undefined) { fields.push(`name = $${paramCount++}`); values.push(name); }
      if (category !== undefined) { fields.push(`category = $${paramCount++}`); values.push(category); }
      if (due_date !== undefined) { fields.push(`due_date = $${paramCount++}`); values.push(due_date); }
      if (completed !== undefined) { fields.push(`completed = $${paramCount++}`); values.push(completed); }
      if (current_progress !== undefined) { fields.push(`current_progress = $${paramCount++}`); values.push(current_progress); }

      if (fields.length === 0) {
        res.status(400).json({ error: "No fields to update." });
        return;
      }

      values.push(taskId);
      const query = `UPDATE foco_tasks SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`;
      const updateResult = await pool.query(query, values);

      if (updateResult.rows.length === 0) {
        res.status(404).json({ error: "Task not found." });
        return;
      }

      const updatedTask = updateResult.rows[0];
      res.json({
        ...updatedTask,
        due_date: updatedTask.due_date instanceof Date ? updatedTask.due_date.toISOString().split('T')[0] : String(updatedTask.due_date).split('T')[0]
      });
    } catch (err: any) {
      console.error("DB Error on PUT /api/tasks/:id, updating local state.", err);
      // Fallback update
      const taskIndex = localTasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        res.status(404).json({ error: "Task not found." });
        return;
      }
      if (name !== undefined) localTasks[taskIndex].name = name;
      if (category !== undefined) localTasks[taskIndex].category = category;
      if (due_date !== undefined) localTasks[taskIndex].due_date = due_date;
      if (completed !== undefined) localTasks[taskIndex].completed = completed;
      if (current_progress !== undefined) localTasks[taskIndex].current_progress = current_progress;

      res.json(localTasks[taskIndex]);
    }
  } else {
    const taskIndex = localTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    if (name !== undefined) localTasks[taskIndex].name = name;
    if (category !== undefined) localTasks[taskIndex].category = category;
    if (due_date !== undefined) localTasks[taskIndex].due_date = due_date;
    if (completed !== undefined) localTasks[taskIndex].completed = completed;
    if (current_progress !== undefined) localTasks[taskIndex].current_progress = current_progress;

    res.json(localTasks[taskIndex]);
  }
});

// DELETE a task
app.delete("/api/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);

  if (dbStatus.mode === "postgres" && pool) {
    try {
      await pool.query("DELETE FROM foco_tasks WHERE id = $1", [taskId]);
      res.json({ success: true, message: `Task ${taskId} deleted successfully.` });
    } catch (err: any) {
      console.error("DB Error on DELETE /api/tasks/:id, deleting from local state.", err);
      localTasks = localTasks.filter(t => t.id !== taskId);
      res.json({ success: true, message: `Task ${taskId} deleted successfully (local).` });
    }
  } else {
    localTasks = localTasks.filter(t => t.id !== taskId);
    res.json({ success: true, message: `Task ${taskId} deleted successfully (local).` });
  }
});

// PUT update a specific milestone (completion status) and recalculate task progress
app.put("/api/milestones/:id", async (req, res) => {
  const milestoneId = parseInt(req.params.id);
  const { completed } = req.body;

  if (completed === undefined) {
    res.status(400).json({ error: "Completed status is required." });
    return;
  }

  if (dbStatus.mode === "postgres" && pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Update the milestone
        const msUpdate = await client.query(
          "UPDATE foco_milestones SET completed = $1 WHERE id = $2 RETURNING *",
          [completed, milestoneId]
        );

        if (msUpdate.rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "Milestone not found." });
          return;
        }

        const updatedMilestone = msUpdate.rows[0];
        const taskId = updatedMilestone.task_id;

        // 2. Fetch all milestones for this task to compute updated overall progress
        const allMilestonesResult = await client.query(
          "SELECT * FROM foco_milestones WHERE task_id = $1 ORDER BY target_progress ASC",
          [taskId]
        );
        const milestones = allMilestonesResult.rows;

        // Smart progress logic:
        // Let's find the maximum target_progress of the completed milestones
        const completedMilestones = milestones.filter(m => m.completed);
        let calculatedProgress = 0;
        
        if (completedMilestones.length > 0) {
          // Progress can be set to the highest completed milestone's target progress,
          // or calculated proportionally. Let's use the highest completed milestone's progress targets!
          calculatedProgress = Math.max(...completedMilestones.map(m => Number(m.target_progress)));
        }

        // 3. Update the parent task's overall progress & completed status
        const isTaskFullyCompleted = calculatedProgress >= 100;
        await client.query(
          "UPDATE foco_tasks SET current_progress = $1, completed = $2 WHERE id = $3",
          [calculatedProgress, isTaskFullyCompleted, taskId]
        );

        await client.query("COMMIT");

        res.json({
          milestone: updatedMilestone,
          task_id: taskId,
          new_progress: calculatedProgress,
          completed: isTaskFullyCompleted
        });
      } catch (txnErr) {
        await client.query("ROLLBACK");
        throw txnErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("DB Error on PUT /api/milestones/:id, updating local state.", err);
      // Fallback
      let foundMilestone: LocalMilestone | null = null;
      let parentTask: LocalTask | null = null;

      for (const t of localTasks) {
        if (t.milestones) {
          const ms = t.milestones.find(m => m.id === milestoneId);
          if (ms) {
            ms.completed = completed;
            foundMilestone = ms;
            parentTask = t;
            break;
          }
        }
      }

      if (!foundMilestone || !parentTask) {
        res.status(404).json({ error: "Milestone not found in local state." });
        return;
      }

      // Calculate progress
      const completedMs = (parentTask.milestones || []).filter(m => m.completed);
      let calculatedProgress = 0;
      if (completedMs.length > 0) {
        calculatedProgress = Math.max(...completedMs.map(m => m.target_progress));
      }

      parentTask.current_progress = calculatedProgress;
      parentTask.completed = calculatedProgress >= 100;

      res.json({
        milestone: foundMilestone,
        task_id: parentTask.id,
        new_progress: calculatedProgress,
        completed: parentTask.completed
      });
    }
  } else {
    // Fallback
    let foundMilestone: LocalMilestone | null = null;
    let parentTask: LocalTask | null = null;

    for (const t of localTasks) {
      if (t.milestones) {
        const ms = t.milestones.find(m => m.id === milestoneId);
        if (ms) {
          ms.completed = completed;
          foundMilestone = ms;
          parentTask = t;
          break;
        }
      }
    }

    if (!foundMilestone || !parentTask) {
      res.status(404).json({ error: "Milestone not found in local state." });
      return;
    }

    // Calculate progress
    const completedMs = (parentTask.milestones || []).filter(m => m.completed);
    let calculatedProgress = 0;
    if (completedMs.length > 0) {
      calculatedProgress = Math.max(...completedMs.map(m => m.target_progress));
    }

    parentTask.current_progress = calculatedProgress;
    parentTask.completed = calculatedProgress >= 100;

    res.json({
      milestone: foundMilestone,
      task_id: parentTask.id,
      new_progress: calculatedProgress,
      completed: parentTask.completed
    });
  }
});


// Configure Vite dev server or static distribution
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FOCO Full-Stack Server running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
