'use strict';

const express = require('express');
const { sequelize } = require('./models');

const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const tagRoutes = require('./routes/tags');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


app.get('/', (req, res) => {
  res.json({
    message: 'Blog API is running',
    endpoints: {
      'POST /users': 'Create a user with profile',
      'GET /users': 'List all users',
      'GET /users/:id': 'Get user with profile, posts, and post tags',
      'POST /posts': 'Create a post and link tags',
      'GET /posts': 'List all posts (with author + tags)',
      'GET /posts/:id': 'Get a single post',
      'POST /tags': 'Create a tag',
      'GET /tags': 'List all tags',
    },
  });
});

app.use('/users', userRoutes);
app.use('/posts', postRoutes);
app.use('/tags', tagRoutes);


app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});


app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    await sequelize.sync();
    console.log('Models synchronised with the database.');

    app.listen(PORT, () => {
      console.log(`Blog API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
