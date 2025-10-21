// Backend API using Node.js + Express + MySQL
// File: server.js

const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" folder
// Serve uploads from /tmp in production, public/uploads in development
const uploadsPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/uploads' 
  : path.join(__dirname, 'public', 'uploads');

app.use('/uploads', express.static(uploadsPath));

// IMPORTANT: Serve uploads directory (this allows /uploads/... URLs to work)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Add this line after your existing static file configurations
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Configuration
// Database Configuration
require('dotenv').config();

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create MySQL connection pool

const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

// Create uploads directory if it doesn't exist (inside public folder)
// Use /tmp for Railway (ephemeral storage)
const uploadDir = process.env.NODE_ENV === 'production' 
  ? '/tmp/uploads' 
  : path.join(__dirname, 'public', 'uploads');

// Configure Multer for DOCUMENT UPLOAD form
const documentStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const timestamp = Date.now().toString();
    const userDir = path.join(uploadDir, 'document-upload', timestamp);
    await fs.mkdir(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Configure Multer for FEEDBACK form (if it has file uploads)
const feedbackStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const timestamp = Date.now().toString();
    const userDir = path.join(uploadDir, 'feedback-form', timestamp);
    await fs.mkdir(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `attachment_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and images are allowed.'), false);
  }
};

const documentUpload = multer({
  storage: documentStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

const feedbackUpload = multer({
  storage: feedbackStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});




// Database initialization
async function initDatabase() {
  const connection = await pool.getConnection();
  
  try {
    // Don't create database - Railway already provides it
    // Just create tables if they don't exist
    
    // Create submissions table for document uploads
    await connection.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sail_p_no VARCHAR(100),
        aadhar_card_path VARCHAR(500) NOT NULL,
        pan_card_path VARCHAR(500) NOT NULL,
        bank_passbook_path VARCHAR(500) NOT NULL,
        passport_photo_path VARCHAR(500) NOT NULL,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email VARCHAR(255),
        ip_address VARCHAR(45),
        status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
        notes TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_sail_p_no (sail_p_no),
        INDEX idx_submission_date (submission_date),
        INDEX idx_status (status)
      )
    `);
    
    // Create feedback table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_submission_date (submission_date)
      )
    `);
    
    // Create contact form table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contact_form (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        message TEXT NOT NULL,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_submission_date (submission_date)
      )
    `);
    
    // Create registration form table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS registration_form (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        event_name VARCHAR(255),
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_submission_date (submission_date)
      )
    `);
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  } finally {
    connection.release();
  }
}


// Initialize database on startup
initDatabase().catch(console.error);

// Helper function to convert file path to URL path
function getUrlPath(filePath) {
  // Convert: /path/to/public/uploads/... -> uploads/...
  return filePath
    .replace(/\\/g, '/')  // Convert backslashes to forward slashes
    .split('public/')[1]; // Remove everything before 'public/'
}

// ============================================
// ROUTES FOR SERVING HTML PAGES
// ============================================

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Document upload form page
app.get('/forms/document-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forms', 'document-upload'));
});

// Feedback form page
app.get('/forms/feedback-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forms', 'feedback.html'));
});

// Contact form page
app.get('/forms/contact-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forms', 'contact-form.html'));
});

// Registration form page
app.get('/forms/registration-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forms', 'registration-form.html'));
});

// Admin dashboard page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forms', 'admin.html'));
});

// ============================================
// API ENDPOINTS FOR DOCUMENT UPLOAD
// ============================================

// Submit documents
app.post('/api/document-upload/submit', documentUpload.fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'bankPassbook', maxCount: 1 },
  { name: 'passportPhoto', maxCount: 1 }
]), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { name, sailPNo, email } = req.body;
    const files = req.files;
    
    // Validate required fields
    if (!name || !files.aadharCard || !files.panCard || 
        !files.bankPassbook || !files.passportPhoto) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields or files' 
      });
    }
    
    // Get client IP
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Convert file paths to URL paths (remove 'public/' prefix)
    const aadharPath = getUrlPath(files.aadharCard[0].path);
    const panPath = getUrlPath(files.panCard[0].path);
    const bankPath = getUrlPath(files.bankPassbook[0].path);
    const photoPath = getUrlPath(files.passportPhoto[0].path);
    
    // Insert into database
    const [result] = await connection.query(
      `INSERT INTO submissions 
       (name, sail_p_no, aadhar_card_path, pan_card_path, 
        bank_passbook_path, passport_photo_path, email, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        sailPNo || null,
        aadharPath,
        panPath,
        bankPath,
        photoPath,
        email || null,
        ipAddress
      ]
    );
    
    res.json({ 
      success: true, 
      message: 'Documents uploaded successfully',
      submissionId: result.insertId
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading documents',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

// Get all document submissions
app.get('/api/document-upload/submissions', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.query(
      'SELECT * FROM submissions ORDER BY submission_date DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching submissions' 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// API ENDPOINTS FOR FEEDBACK FORM
// ============================================

app.post('/api/feedback/submit', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    const [result] = await connection.query(
      'INSERT INTO feedback (name, email, message) VALUES (?, ?, ?)',
      [name, email, message]
    );
    
    res.json({ 
      success: true, 
      message: 'Feedback submitted successfully',
      feedbackId: result.insertId
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting feedback' 
    });
  } finally {
    connection.release();
  }
});

// Get all feedback
app.get('/api/feedback/submissions', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.query(
      'SELECT * FROM feedback ORDER BY submission_date DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching feedback' 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// API ENDPOINTS FOR CONTACT FORM
// ============================================

app.post('/api/contact/submit', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    const [result] = await connection.query(
      'INSERT INTO contact_form (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject || null, message]
    );
    
    res.json({ 
      success: true, 
      message: 'Contact form submitted successfully',
      contactId: result.insertId
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting contact form' 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// API ENDPOINTS FOR REGISTRATION FORM
// ============================================

app.post('/api/registration/submit', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { name, email, phone, eventName } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    const [result] = await connection.query(
      'INSERT INTO registration_form (name, email, phone, event_name) VALUES (?, ?, ?, ?)',
      [name, email, phone || null, eventName || null]
    );
    
    res.json({ 
      success: true, 
      message: 'Registration submitted successfully',
      registrationId: result.insertId
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting registration' 
    });
  } finally {
    connection.release();
  }
});

// ============================================
// LEGACY API ENDPOINTS (for backward compatibility)
// ============================================

// Keep old /api/submit endpoint working
app.post('/api/submit', documentUpload.fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'bankPassbook', maxCount: 1 },
  { name: 'passportPhoto', maxCount: 1 }
]), async (req, res) => {
  // Redirect to new endpoint handler
  req.url = '/api/document-upload/submit';
  return app._router.handle(req, res);
});

// Keep old /api/submissions endpoint working
app.get('/api/submissions', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.query(
      'SELECT * FROM submissions ORDER BY submission_date DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching submissions' 
    });
  } finally {
    connection.release();
  }
});

// Get submission by ID
app.get('/api/submissions/:id', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.query(
      'SELECT * FROM submissions WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching submission' 
    });
  } finally {
    connection.release();
  }
});

// Search submissions
app.get('/api/search', async (req, res) => {
  const connection = await pool.getConnection();
  const { name, sailPNo } = req.query;
  
  try {
    let query = 'SELECT * FROM submissions WHERE 1=1';
    const params = [];
    
    if (name) {
      query += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    
    if (sailPNo) {
      query += ' AND sail_p_no LIKE ?';
      params.push(`%${sailPNo}%`);
    }
    
    query += ' ORDER BY submission_date DESC';
    
    const [rows] = await connection.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error searching submissions' 
    });
  } finally {
    connection.release();
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Available Pages:`);
  console.log(`   🏠 Landing Page: http://localhost:${PORT}`);
  console.log(`   📄 Document Upload: http://localhost:${PORT}/forms/document-upload`);
  console.log(`   💬 Feedback Form: http://localhost:${PORT}/forms/feedback-form`);
  console.log(`   📧 Contact Form: http://localhost:${PORT}/forms/contact-form`);
  console.log(`   ✍️  Registration Form: http://localhost:${PORT}/forms/registration-form`);
  console.log(`   👨‍💼 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`\n🔗 API Endpoints:`);
  console.log(`   POST /api/document-upload/submit`);
  console.log(`   POST /api/feedback/submit`);
  console.log(`   POST /api/contact/submit`);
  console.log(`   POST /api/registration/submit`);
  console.log(`   GET  /api/health\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
