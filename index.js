const express = require('express');
const app = express();
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true
}));
// Create a connection pool to the PostgreSQL database
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Node portfolio',
  password: 'root',
  port: 5432, // Replace with your PostgreSQL port if necessary
});

app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JavaScript, images)
app.use(express.static(path.join(__dirname, 'public')));

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/submit-form', (req, res) => {
  const { input1, input2, input3, input4, input5 } = req.body; // Replace input1, input2, input3 with the actual names of your form fields

  // Insert the form data into the PostgreSQL database
  pool.query('INSERT INTO tadePortfolio (name, email, address, pnumber, message ) VALUES ($1, $2, $3, $4, $5)', [input1, input2, input3, input4, input5], (error, result) => {
    if (error) {
      console.error('Error saving form data:', error);
      res.status(500).send('Error saving form data');
    } else {
      // res.status(200).send('Form data saved successfully');
      // Redirect to the index.html home page with success parameter
      res.redirect('/?success=true');
    }
  });
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/loginUser', async (req, res) => {
  const { username, password } = req.body;

  // Retrieve the user from the database
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];

  // Check if the user exists
  if (!user) {
    res.status(401).send('Invalid username or password'); // Return an error response if the user does not exist
    return;
  }

  // Verify the password
  if (password !== user.password) {
    res.status(401).send('Invalid username or password'); // Return an error response if the password is incorrect
    return;
  }

  // Generate a JWT token
  const token = jwt.sign({ username: user.username }, 'your-secret-key', { expiresIn: '1m' }); // Replace 'your-secret-key' with your own secret key
// Store the token in the session
req.session.token = token;

  // Redirect to admin.html with the token as a query parameter
  res.redirect(302, `/admina.html?token=${encodeURIComponent(token)}`);
});
app.get('/admina.html', (req, res) => {
  // Check if the token exists in the session
  if (!req.session.token) {
    res.redirect('/login');
    return;
  }

  // const { token } = req.query;

  try {
    // Verify the token
    // const decoded = jwt.verify(decodeURIComponent(token), 'your-secret-key'); // Replace 'your-secret-key' with your own secret key
    const decoded = jwt.verify(req.session.token, 'your-secret-key');
    // Fetch the data from the database
    pool.query('SELECT * FROM tadePortfolio', (error, result) => {
      if (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
        return;
      }

      const data = result.rows;

      // Render the data in HTML and send it as a response
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Admin</title>
            <style>
              table {
                border-collapse: collapse;
                width: 100%;
              }
              th, td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #ddd;
              }
              tr:hover {background-color: #f5f5f5;}

              .delete-btn {
                background-color: #f44336;
                color: white;
                border: none;
                padding: 5px 10px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                cursor: pointer;
              }
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
                ${data
                  .map(
                    (row) => `
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
                    `
                  )
                  .join('')}
              </tbody>
            </table>
            <form action="/logout" method="post">
              <button type="submit" class="logout-btn">Logout</button>
            </form>
            <script>
              // Disable browser back button
              history.pushState(null, null, location.href);
              window.onpopstate = function () {
                history.go(1);
              };

              // Function to delete a record
              function deleteRecord(recordId) {
                if (confirm('Are you sure you want to delete this record?')) {
                  // Send an AJAX request to delete the record
                  const xhr = new XMLHttpRequest();
                  xhr.open('DELETE', '/records/' + recordId, true);
                  xhr.onload = function () {
                    if (xhr.status === 200) {
                      // Reload the page after successful deletion
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
    res.redirect('/login'); // Redirect to the login page if the token is invalid
  }
});

// Handle the DELETE request to delete a record
app.delete('/records/:id', (req, res) => {
  const recordId = req.params.id;

  // Delete the record from the database
  pool.query('DELETE FROM tadePortfolio WHERE id = $1', [recordId], (error, result) => {
    if (error) {
      console.error('Error deleting record:', error);
      res.status(500).send('Error deleting record');
    } else {
      res.sendStatus(200); // Send a success response
    }
  });
});
app.post('/logout', (req, res) => {
  // Clear the token from the session
  req.session.token = null;

  // Redirect to the login page
  res.redirect('/login');
});
const port = 3000; // Replace with your desired port number
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
