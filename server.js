import Fastify from 'fastify'
import pg from 'pg'
import cors from '@fastify/cors'
import path from "path"
import { fileURLToPath } from "url"
import fastifyStatic from "@fastify/static"
const fastify = Fastify({ logger: true })
await fastify.register(cors, {
  origin: '*',
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
})
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

await fastify.register(fastifyStatic, {
  root: __dirname,
})

const db = new pg.Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  database: 'smarthub',
  port: 5432
})

// ---- USERS ----

fastify.post('/users', async (request) => {
    const { name, role } = request.body
    console.log("User created ✅", { name, role });
    const { rows } = await db.query(
      'INSERT INTO users (name, role) VALUES ($1, $2) RETURNING *',
      [name, role]
    )
  
    return rows[0]
  })
  fastify.get('/users', async () => {
    const { rows } = await db.query('SELECT * FROM users ORDER BY id DESC')
    return rows
  })
// ---- TASKS ----

fastify.post('/tasks', async (request) => {
    const { title, assigned_to, day_of_week } = request.body
  
    const { rows } = await db.query(
      `INSERT INTO tasks (title, assigned_to, day_of_week)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, assigned_to, day_of_week]
    )
  
    return rows[0]
  })
  fastify.get('/tasks/today/:userId', async (request) => {
    const { userId } = request.params
    const today = new Date().getDay()
  
    const { rows } = await db.query(
      'SELECT * FROM tasks WHERE assigned_to = $1 AND day_of_week = $2',
      [userId, today]
    )
  
    return rows
  })
  fastify.get('/tasks/assigned/:userId', async (request) => {
    const { userId } = request.params
  
    const { rows } = await db.query(
      'SELECT * FROM tasks WHERE assigned_to = $1 ORDER BY id DESC',
      [userId]
    )
  
    return rows
  })
  fastify.get('/tasks', async () => {
    const { rows } = await db.query('SELECT * FROM tasks ORDER BY id DESC')
    return rows
  })
  // ---- URGENT TASKS ----

// Create urgent task
fastify.post('/urgent_tasks', async (request) => {
  const { title, assigned_to } = request.body

  const { rows } = await db.query(
    `
    INSERT INTO urgent_tasks (title, assigned_to)
    VALUES ($1, $2)
    RETURNING *
    `,
    [title, assigned_to]
  )

  return rows[0]
})
// GET all urgent tasks
fastify.get("/urgent_tasks", async () => {
  const { rows } = await db.query(
    "SELECT * FROM urgent_tasks ORDER BY id DESC"
  );
  return rows;
});

// Get urgent tasks by user
fastify.get('/urgent_tasks/:userId', async (request) => {
  const { userId } = request.params

  const { rows } = await db.query(
    `
    SELECT * FROM urgent_tasks
    WHERE assigned_to = $1
    ORDER BY id DESC
    `,
    [userId]
  )

  return rows
})
// Get today's tasks
fastify.get("/tasks/today", async (request, reply) => {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

  const { rows } = await db.query(
    "SELECT * FROM tasks WHERE day_of_week = $1 ORDER BY id DESC",
    [day]
  );

  return rows;
});
// Acknowledge urgent task
fastify.patch('/urgent_tasks/:id/ack', async (request) => {
  const { id } = request.params

  const { rows } = await db.query(
    `
    UPDATE urgent_tasks
    SET acknowledged = true
    WHERE id = $1
    RETURNING *
    `,
    [id]
  )

  return rows[0]
})
fastify.get('/today/:userId', async (request) => {
  const { userId } = request.params
  const today = new Date().getDay()

  const urgent = await db.query(
    `SELECT * FROM urgent_tasks
     WHERE assigned_to = $1 AND acknowledged = false
     ORDER BY id DESC`,
    [userId]
  )

  const normal = await db.query(
    `SELECT * FROM tasks
     WHERE assigned_to = $1 AND day_of_week = $2
     ORDER BY id DESC`,
    [userId, today]
  )

  return {
    urgent: urgent.rows,
    tasks: normal.rows,
  }
})
// ---- HEALTH CHECK ----
fastify.get('/', async () => {
  return { status: 'Smart Home Hub backend running' }
})

fastify.listen({ port: 3001 }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})