// config/serverConfig.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const configureServer = (app) => {
  // Middlewares
  app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  }));
  app.use(express.json());

  // Create upload directories
  const resumesDir = path.join(__dirname, '..', 'uploads', 'resumes');
  if (!fs.existsSync(resumesDir)) {
    fs.mkdirSync(resumesDir, { recursive: true });
  }

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("✅ Created uploads directory at", uploadsDir);
  }
};

module.exports = configureServer;