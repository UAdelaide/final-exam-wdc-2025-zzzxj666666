const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mysql = require('mysql2/promise');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Zxjde05.'
    });

    await connection.query('DROP DATABASE IF EXISTS DogWalkService');
    await connection.query('CREATE DATABASE DogWalkService');
    await connection.end();

    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Zxjde05.',
      database: 'DogWalkService'
    });

    await db.execute(`
      CREATE TABLE Users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('owner', 'walker') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await db.execute(`
      CREATE TABLE Dogs (
        dog_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        size ENUM('small', 'medium', 'large') NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES Users(user_id)
      )`);

    await db.execute(`
      CREATE TABLE WalkRequests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        dog_id INT NOT NULL,
        requested_time DATETIME NOT NULL,
        duration_minutes INT NOT NULL,
        location VARCHAR(255) NOT NULL,
        status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
      )`);

    await db.execute(`
      CREATE TABLE WalkApplications (
        application_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        CONSTRAINT unique_application UNIQUE (request_id, walker_id)
      )`);

    await db.execute(`
      CREATE TABLE WalkRatings (
        rating_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        walker_id INT NOT NULL,
        owner_id INT NOT NULL,
        rating INT CHECK (rating BETWEEN 1 AND 5),
        comments TEXT,
        rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id),
        FOREIGN KEY (owner_id) REFERENCES Users(user_id),
        CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
      )`);

    // Insert users
    await db.execute(`INSERT INTO Users (username, email, password_hash, role) VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('danwalker', 'dan@example.com', 'hashed321', 'walker'),
      ('eveowner', 'eve@example.com', 'hashed654', 'owner')`);

    // Insert dogs
    await db.execute(`INSERT INTO Dogs (owner_id, name, size) VALUES
      ((SELECT user_id FROM Users WHERE username='alice123'), 'Max', 'medium'),
      ((SELECT user_id FROM Users WHERE username='carol123'), 'Bella', 'small'),
      ((SELECT user_id FROM Users WHERE username='eveowner'), 'Rocky', 'large'),
      ((SELECT user_id FROM Users WHERE username='alice123'), 'Luna', 'small'),
      ((SELECT user_id FROM Users WHERE username='carol123'), 'Charlie', 'medium')`);

    // Insert walk requests
    await db.execute(`INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
      ((SELECT dog_id FROM Dogs WHERE name='Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name='Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
      ((SELECT dog_id FROM Dogs WHERE name='Rocky'), '2025-06-11 10:00:00', 60, 'Central Park', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name='Luna'), '2025-06-12 07:00:00', 20, 'Lakeview Trail', 'completed'),
      ((SELECT dog_id FROM Dogs WHERE name='Charlie'), '2025-06-13 18:00:00', 40, 'Hilltop Road', 'cancelled')`);

    console.log('Database and seed data ready');
  } catch (err) {
    console.error('Database error:', err);
  }
})();

app.get('/api/dogs', async (req, res) => {
  try {
    const [dogs] = await db.execute(`
      SELECT d.dog_id, d.name AS dog_name, d.size, u.username AS owner
      FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(dogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [requests] = await db.execute(`
      SELECT w.request_id, d.name AS dog_name, w.requested_time, w.duration_minutes, w.location
      FROM WalkRequests w
      JOIN Dogs d ON w.dog_id = d.dog_id
      WHERE w.status = 'open'
    `);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [summary] = await db.execute(`
      SELECT u.username, COUNT(DISTINCT wa.application_id) AS applications,
             COUNT(DISTINCT wr.request_id) AS completed_walks,
             AVG(r.rating) AS avg_rating
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRequests wr ON wa.request_id = wr.request_id AND wr.status = 'completed'
      LEFT JOIN WalkRatings r ON wr.request_id = r.request_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id
    `);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summary' });
  }
});

module.exports = app;

app.use(express.static(path.join(__dirname, 'public')));