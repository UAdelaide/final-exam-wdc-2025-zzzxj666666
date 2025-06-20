const express = require('express');
const path = require('path');
require('dotenv').config();
const dogRoutes = require('./routes/dogRoutes');

const app = express();

// Middleware
app.use(express.json());

const session = require('express-session');

app.use(session({
  secret: 'dogwalking-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname, '/public')));

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);

// Export the app instead of listening here
module.exports = app;
app.use('/api/dogs', dogRoutes);