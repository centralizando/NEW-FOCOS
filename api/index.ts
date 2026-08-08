import express from "express";
import path from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dotenv from "dotenv";

dotenv.config();

// Configure Neon to use the ws library for WebSockets in Node environments
neonConfig.webSocketConstructor = ws;

const app = express();
const PORT = 3000;

app.use(express.json());

// Neon DB Connection details - strictly use the requested connection string
const dbUrl = "postgresql://neondb_owner:npg_ERaPq9szZ3kp@ep-wispy-fog-at3k4k0x-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

let dbStatus = {
  connected: false,
  mode: "uninitialized" as "postgres" | "fallback" | "uninitialized",
  error: null as string | null
};

let pool: Pool | null = null;

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

      // Add location column to allow splitting today's tasks into 'casa' vs 'trabalho'
      await client.query(`
        ALTER TABLE foco_milestones ADD COLUMN IF NOT EXISTS location VARCHAR(20) DEFAULT 'casa';
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
              target_progress: Number(m.target_progress),
              location: m.location || 'casa'
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

// PUT update a specific milestone (completion status, location, or rescheduled date) and recalculate task progress
app.put("/api/milestones/:id", async (req, res) => {
  const milestoneId = parseInt(req.params.id);
  const { completed, location, date_string } = req.body;

  if (completed === undefined && location === undefined && date_string === undefined) {
    res.status(400).json({ error: "Completed status, location, or date_string is required." });
    return;
  }

  if (dbStatus.mode === "postgres" && pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Update the milestone dynamically
        const fields = [];
        const queryParams = [];
        let paramIndex = 1;

        if (completed !== undefined) {
          fields.push(`completed = $${paramIndex++}`);
          queryParams.push(completed);
        }
        if (location !== undefined) {
          fields.push(`location = $${paramIndex++}`);
          queryParams.push(location);
        }
        if (date_string !== undefined) {
          fields.push(`date_string = $${paramIndex++}`);
          queryParams.push(date_string);
        }

        queryParams.push(milestoneId);
        const queryStr = `UPDATE foco_milestones SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

        const msUpdate = await client.query(queryStr, queryParams);

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
        const completedMilestones = milestones.filter(m => m.completed);
        let calculatedProgress = 0;
        
        if (completedMilestones.length > 0) {
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
          milestone: {
            ...updatedMilestone,
            target_progress: Number(updatedMilestone.target_progress),
            location: updatedMilestone.location || 'casa'
          },
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
      let foundMilestone: any = null;
      let parentTask: any = null;

      for (const t of localTasks) {
        if (t.milestones) {
          const ms = t.milestones.find(m => m.id === milestoneId);
          if (ms) {
            if (completed !== undefined) ms.completed = completed;
            if (location !== undefined) (ms as any).location = location;
            if (date_string !== undefined) ms.date_string = date_string;
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
    let foundMilestone: any = null;
    let parentTask: any = null;

    for (const t of localTasks) {
      if (t.milestones) {
        const ms = t.milestones.find(m => m.id === milestoneId);
        if (ms) {
          if (completed !== undefined) ms.completed = completed;
          if (location !== undefined) (ms as any).location = location;
          if (date_string !== undefined) ms.date_string = date_string;
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

// DELETE a milestone
app.delete("/api/milestones/:id", async (req, res) => {
  const milestoneId = parseInt(req.params.id);

  if (dbStatus.mode === "postgres" && pool) {
    try {
      await pool.query("DELETE FROM foco_milestones WHERE id = $1", [milestoneId]);
      res.json({ success: true, message: `Milestone ${milestoneId} deleted.` });
    } catch (err: any) {
      console.error("DB Error on DELETE /api/milestones/:id", err);
      // Fallback
      for (const t of localTasks) {
        if (t.milestones) {
          t.milestones = t.milestones.filter(m => m.id !== milestoneId);
        }
      }
      res.json({ success: true, message: `Milestone ${milestoneId} deleted (local).` });
    }
  } else {
    for (const t of localTasks) {
      if (t.milestones) {
        t.milestones = t.milestones.filter(m => m.id !== milestoneId);
      }
    }
    res.json({ success: true, message: `Milestone ${milestoneId} deleted (local).` });
  }
});


// Multi-database Neon Review Checker Endpoint
const TARGET_DATABASES: Record<string, string> = {
  GERAL: process.env.NEON_DB_GERAL || "postgresql://neondb_owner:npg_bMg3l2cxdUCR@ep-damp-sound-aw5tdkxo-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ENGLISH: process.env.NEON_DB_ENGLISH || "postgresql://neondb_owner:npg_LoXV3C7IFiBh@ep-morning-bird-ax4nha9k-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  LINUX: process.env.NEON_DB_LINUX || "postgresql://neondb_owner:npg_G5NY8gBqThCl@ep-wispy-lake-ayededeo-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
};

async function inspectDbForReviews(key: string, connectionString: string) {
  const tempPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    const client = await tempPool.connect();
    try {
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      
      const tables = tablesRes.rows.map(r => r.table_name);
      let totalPendingReviews = 0;
      let totalItems = 0;
      const tableSummaries: any[] = [];

      for (const tableName of tables) {
        const colsRes = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
        `, [tableName]);

        const colsInfo = colsRes.rows.map(c => ({
          name: c.column_name,
          lower: c.column_name.toLowerCase(),
          type: c.data_type.toLowerCase()
        }));

        const colNames = colsInfo.map(c => c.lower);

        // Find date / timestamp columns for reviews/due
        const dateColObj = colsInfo.find(c => 
          c.lower.includes('review') || 
          c.lower.includes('revis') || 
          c.lower.includes('due') || 
          c.lower.includes('schedul') || 
          c.lower.includes('proxim') ||
          c.lower.includes('expire') ||
          (c.lower.includes('next') && (c.lower.includes('date') || c.lower.includes('at') || c.lower.includes('time') || c.lower.includes('day')))
        ) || colsInfo.find(c => c.type.includes('date') || c.type.includes('timestamp'));

        // Find completion / boolean columns
        const boolColObj = colsInfo.find(c => 
          c.lower.includes('completed') || 
          c.lower.includes('revisad') || 
          c.lower.includes('done') || 
          c.lower.includes('learned') || 
          c.lower.includes('mastered') || 
          c.lower.includes('finished') ||
          c.lower.includes('reviewed')
        ) || colsInfo.find(c => c.type === 'boolean');

        // Find status / state column
        const statusColObj = colsInfo.find(c => 
          c.lower === 'status' || 
          c.lower === 'state' || 
          c.lower.includes('status') || 
          c.lower.includes('state')
        );

        let totalInTable = 0;
        try {
          const totalRes = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          totalInTable = parseInt(totalRes.rows[0]?.count || "0", 10);
        } catch (e) {}

        let pendingInTable = 0;

        // Custom exact calculation per database schema provided by the user
        if (key === 'ENGLISH' && tableName.toLowerCase() === 'curso_progresso') {
          try {
            const q = `
              SELECT COUNT(*) as count 
              FROM curso_progresso 
              WHERE concluida = TRUE 
                AND data_conclusao IS NOT NULL 
                AND (data_conclusao::timestamp + (COALESCE(dias_revisao, 30) || ' days')::interval) <= CURRENT_TIMESTAMP;
            `;
            const resVal = await client.query(q);
            pendingInTable = parseInt(resVal.rows[0]?.count || "0", 10);
          } catch (e) {
            console.error("Error querying ENGLISH specific review query:", e);
          }
        } else if (key === 'LINUX' && tableName.toLowerCase() === 'curso_progresso') {
          try {
            const q = `
              SELECT COUNT(*) as count 
              FROM curso_progresso 
              WHERE concluida = TRUE 
                AND data_conclusao IS NOT NULL 
                AND COALESCE(NULLIF(split_part(data_conclusao, '|', 2), ''), '30')::integer > 0 
                AND (split_part(data_conclusao, '|', 1)::timestamp 
                  + (COALESCE(NULLIF(split_part(data_conclusao, '|', 2), ''), '30')::integer || ' days')::interval) <= NOW();
            `;
            const resVal = await client.query(q);
            pendingInTable = parseInt(resVal.rows[0]?.count || "0", 10);
          } catch (e) {
            console.error("Error querying LINUX specific review query:", e);
          }
        } else if (key === 'GERAL' && tableName.toLowerCase() === 'neon_notes') {
          try {
            const q = `
              SELECT COUNT(*) as count 
              FROM neon_notes 
              WHERE review_at IS NOT NULL 
                AND review_at <= CURRENT_TIMESTAMP;
            `;
            const resVal = await client.query(q);
            pendingInTable = parseInt(resVal.rows[0]?.count || "0", 10);
          } catch (e) {
            console.error("Error querying GERAL specific review query:", e);
          }
        } else {
          // Dynamic inspection fallback for other tables or schema variations
          let whereClauses: string[] = [];

          if (dateColObj) {
            if (dateColObj.type.includes('int')) {
              whereClauses.push(`("${dateColObj.name}" <= EXTRACT(EPOCH FROM NOW()) * 1000 OR "${dateColObj.name}" <= EXTRACT(EPOCH FROM NOW()))`);
            } else if (dateColObj.type.includes('char') || dateColObj.type.includes('text')) {
              whereClauses.push(`("${dateColObj.name}" <= TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') OR "${dateColObj.name}" <= TO_CHAR(NOW(), 'YYYY-MM-DD') OR "${dateColObj.name}" <= CURRENT_DATE::text)`);
            } else {
              whereClauses.push(`("${dateColObj.name}" <= NOW() OR "${dateColObj.name}" <= CURRENT_DATE)`);
            }
          }

          if (boolColObj) {
            whereClauses.push(`"${boolColObj.name}" = false`);
          } else if (statusColObj) {
            whereClauses.push(`LOWER("${statusColObj.name}"::text) NOT IN ('done', 'completed', 'concluido', 'concluído', 'mastered', 'learned', 'finished', 'ok', '1', 'true', 'reviewed')`);
          }

          if (totalInTable > 0 && whereClauses.length > 0) {
            const queryCombined = `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClauses.join(" AND ")}`;
            try {
              const pRes = await client.query(queryCombined);
              pendingInTable = parseInt(pRes.rows[0]?.count || "0", 10);
            } catch (e) {
              console.error(`Error querying dynamic pending for ${tableName}:`, e);
              pendingInTable = 0;
            }
          }
        }

        totalPendingReviews += pendingInTable;
        totalItems += totalInTable;

        tableSummaries.push({
          tableName,
          totalItems: totalInTable,
          pendingReviews: pendingInTable,
          columns: colNames,
          dateCol: dateColObj?.name || null,
          boolCol: boolColObj?.name || null,
          statusCol: statusColObj?.name || null
        });
      }

      return {
        key,
        connected: true,
        tablesCount: tables.length,
        totalItems,
        pendingReviews: totalPendingReviews,
        tables: tableSummaries,
        hasReviews: totalPendingReviews > 0,
        lastChecked: new Date().toISOString()
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`Error checking reviews for DB ${key}:`, err.message);
    return {
      key,
      connected: false,
      error: err.message,
      pendingReviews: 0,
      hasReviews: false,
      lastChecked: new Date().toISOString()
    };
  } finally {
    try { await tempPool.end(); } catch (e) {}
  }
}

app.get("/api/check-reviews", async (req, res) => {
  try {
    const results: Record<string, any> = {};
    const promises = Object.entries(TARGET_DATABASES).map(async ([key, url]) => {
      const resData = await inspectDbForReviews(key, url);
      results[key] = resData;
    });

    await Promise.all(promises);

    const totalPending = Object.values(results).reduce((acc, curr) => acc + (curr.pendingReviews || 0), 0);
    const hasAnyReview = totalPending > 0;

    res.json({
      success: true,
      totalPending,
      hasAnyReview,
      databases: results,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
