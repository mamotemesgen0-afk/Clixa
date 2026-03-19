const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Ensure data dir and DB file
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {}
  return { submissions: [], pageViews: [], toolUsage: [] };
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Seed some demo data if empty
function seedDB() {
  const db = readDB();
  if (db.submissions.length > 0) return;

  const types = ['consult-success', 'mkt-success', 'nl-success'];
  const names = ['Dr. Abebe Girma', 'Nurse Tigist Haile', 'Dr. Selam Bekele', 'Yonas Tesfaye', 'Dr. Marta Alemu', 'Hana Kebede', 'Dr. Daniel Wubet', 'Sara Mulatu', 'Dr. Yohannes Getahun', 'Feven Tadesse'];
  const orgs = ['Tikur Anbessa Hospital', 'Bethlehem Medical Center', 'EtCare MCH', 'Dream Ortho Spine', 'BMY Diagnostics', 'Addis Clinic', 'Nairobi Health Hub', 'Grand Bishoftu Hospital'];
  const statuses = ['new', 'new', 'contacted', 'contacted', 'converted', 'new', 'contacted'];

  for (let i = 0; i < 24; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    db.submissions.push({
      id: uuidv4(),
      type: types[Math.floor(Math.random() * types.length)],
      name: names[Math.floor(Math.random() * names.length)],
      email: 'contact@clinic.com',
      org: orgs[Math.floor(Math.random() * orgs.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      timestamp: d.toISOString(),
      notes: ''
    });
  }

  const pages = ['index.html', 'emr.html', 'tools.html', 'marketing.html', 'portfolio.html', 'consultancy.html'];
  for (let i = 0; i < 180; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    db.pageViews.push({
      page: pages[Math.floor(Math.random() * pages.length)],
      timestamp: d.toISOString()
    });
  }

  const tools = ['chads', 'bmi', 'egfr', 'gcs', 'curb65', 'edd', 'qsofa', 'wells_pe', 'apgar', 'fena', 'nyha', 'qtc'];
  for (let i = 0; i < 120; i++) {
    db.toolUsage.push({ tool: tools[Math.floor(Math.random() * tools.length)], timestamp: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString() });
  }

  writeDB(db);
}
seedDB();

// ── ROUTES ─────────────────────────────────────────────

// Submit form
app.post('/api/submissions', (req, res) => {
  const db = readDB();
  const sub = {
    id: uuidv4(),
    ...req.body,
    status: 'new',
    timestamp: new Date().toISOString(),
    notes: ''
  };
  db.submissions.unshift(sub);
  writeDB(db);
  res.json({ success: true, id: sub.id });
});

// Get all submissions
app.get('/api/submissions', (req, res) => {
  const db = readDB();
  let subs = db.submissions;
  if (req.query.status) subs = subs.filter(s => s.status === req.query.status);
  if (req.query.type) subs = subs.filter(s => s.type === req.query.type);
  res.json(subs);
});

// Update submission status / notes
app.patch('/api/submissions/:id', (req, res) => {
  const db = readDB();
  const idx = db.submissions.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.submissions[idx] = { ...db.submissions[idx], ...req.body };
  writeDB(db);
  res.json(db.submissions[idx]);
});

// Delete submission
app.delete('/api/submissions/:id', (req, res) => {
  const db = readDB();
  db.submissions = db.submissions.filter(s => s.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// Track page view
app.post('/api/track', (req, res) => {
  const db = readDB();
  db.pageViews.push({ page: req.body.page || 'unknown', timestamp: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true });
});

// Analytics summary
app.get('/api/analytics', (req, res) => {
  const db = readDB();
  const now = new Date();
  const views30 = db.pageViews.filter(v => (now - new Date(v.timestamp)) < 30 * 86400000);
  const views7 = db.pageViews.filter(v => (now - new Date(v.timestamp)) < 7 * 86400000);
  
  // Page counts
  const pageCounts = {};
  views30.forEach(v => { pageCounts[v.page] = (pageCounts[v.page] || 0) + 1; });
  
  // Tool usage counts
  const toolCounts = {};
  db.toolUsage.forEach(t => { toolCounts[t.tool] = (toolCounts[t.tool] || 0) + 1; });

  // Submissions by type
  const subsByType = {};
  db.submissions.forEach(s => { subsByType[s.type] = (subsByType[s.type] || 0) + 1; });

  // Submissions by status
  const subsByStatus = {};
  db.submissions.forEach(s => { subsByStatus[s.status] = (subsByStatus[s.status] || 0) + 1; });

  // Daily views last 14 days
  const daily = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily[key] = 0;
  }
  views30.forEach(v => {
    const key = v.timestamp.slice(0, 10);
    if (key in daily) daily[key]++;
  });

  res.json({
    totalViews: db.pageViews.length,
    views30Days: views30.length,
    views7Days: views7.length,
    totalSubmissions: db.submissions.length,
    newSubmissions: db.submissions.filter(s => s.status === 'new').length,
    pageCounts,
    toolCounts,
    subsByType,
    subsByStatus,
    dailyViews: Object.entries(daily).map(([date, count]) => ({ date, count }))
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Clixa Health server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard at http://localhost:${PORT}/dashboard.html`);
  console.log(`🌐 Website at http://localhost:${PORT}/index.html`);
});
