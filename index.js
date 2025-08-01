// index.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/dbConnect');
const configureServer = require('./config/serverConfig');
const app = express();

// Configure server
configureServer(app);

// Connect to database
connectDB();

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/jobs', require('./routes/jobsRoutes'));
app.use('/api/resumes', require('./routes/resumesRoutes'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/recruiter', require('./routes/recruiterRoutes'));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));