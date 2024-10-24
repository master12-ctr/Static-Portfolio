const express = require('express');
require('dotenv').config();
const app = express();
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Middleware
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true } // Set to true if using HTTPS
}));
app.use(express.static(path.join(__dirname, 'public')));

// Database connection pool
const pool = new Pool({
  user: process.env.DATABASE_USER,
  host: 'localhost',
  database: 'Node portfolio',
  password: process.env.DATABASE_PASSWORD,
  port: 5432,
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/submit-form', [
  body('input1').notEmpty(),
  body('input2').isEmail(),
  body('input3').notEmpty(),
  body('input4').isNumeric(),
  body('input5').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { input1, input2, input3, input4, input5 } = req.body;

  pool.query('INSERT INTO tadePortfolio (name, email, address, pnumber, message) VALUES ($1, $2, $3, $4, $5)',
    [input1, input2, input3, input4, input5], (error) => {
      if (error) {
        console.error('Error saving form data:', error);
        return res.status(500).send('Error saving form data');
      }
      res.redirect('/?success=true');
    });
});

// Login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// User login handling
app.post('/loginUser', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).send('Invalid username or password');
    }

    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '1m' });
    req.session.token = token;
    res.redirect(302,'/admina.html');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Admin page
app.get('/admina.html', (req, res) => {
  if (!req.session.token) {
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(req.session.token, process.env.JWT_SECRET);
    pool.query('SELECT * FROM tadePortfolio', (error, result) => {
      if (error) {
        console.error('Error fetching data:', error);
        return res.status(500).send('Error fetching data');
      }

      const data = result.rows;
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Admin</title>
            <style>
              table { border-collapse: collapse; width: 100%; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              tr:hover { background-color: #f5f5f5; }
              .delete-btn { background-color: #f44336; color: white; border: none; padding: 5px 10px; cursor: pointer; }
            </style>
          </head>
          <body>
            <h1>Contact List</h1>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Phone Number</th>
                  <th>Message</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(row => `
                  <tr>
                    <td>${row.name}</td>
                    <td>${row.email}</td>
                    <td>${row.address}</td>
                    <td>${row.pnumber}</td>
                    <td>${row.message}</td>
                    <td>
                      <button class="delete-btn" onclick="deleteRecord(${row.id})">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <form action="/logout" method="post">
              <button type="submit" class="logout-btn">Logout</button>
            </form>
            <script>
              function deleteRecord(recordId) {
                if (confirm('Are you sure you want to delete this record?')) {
                  const xhr = new XMLHttpRequest();
                  xhr.open('DELETE', '/records/' + recordId, true);
                  xhr.onload = function () {
                    if (xhr.status === 200) {
                      location.reload();
                    } else {
                      alert('Failed to delete the record');
                    }
                  };
                  xhr.send();
                }
              }
            </script>
          </body>
        </html>
      `;
      res.send(html);
    });
  } catch (error) {
    console.error('Invalid token:', error);
    res.redirect('/login');
  }
});

// Handle DELETE request
app.delete('/records/:id', (req, res) => {
  const recordId = req.params.id;
  pool.query('DELETE FROM tadePortfolio WHERE id = $1', [recordId], (error) => {
    if (error) {
      console.error('Error deleting record:', error);
      return res.status(500).send('Error deleting record');
    }
    res.sendStatus(200);
  });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.token = null;
  res.redirect('/login');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
const port = process.env.PORT || 3000; // Use environment variable for the port
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});