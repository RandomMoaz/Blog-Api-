'use strict';
const pgMem = require('pg-mem');
const memDb = pgMem.newDb();
const fakePg = memDb.adapters.createPg();

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'pg') return fakePg;
  if (request === 'pg-hstore') {
    return {
      parse: () => ({}),
      stringify: (o) => JSON.stringify(o),
    };
  }
  return origLoad.call(this, request, parent, isMain);
};

// 2. Force the test environment to use Postgres against the fake driver.
process.env.NODE_ENV = 'test_pg';

// Override the test_pg config inside the loaded config module
const configModule = require('./config/config.js');
configModule.test_pg = {
  username: 'test',
  password: 'test',
  database: 'test',
  host: 'localhost',
  dialect: 'postgres',
  logging: false,
};

// Re-export so models/index.js picks it up
require.cache[require.resolve('./config/config.js')].exports = configModule;

const http = require('http');
const { sequelize } = require('./models');

// 3. Tiny HTTP request helper.
function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const { port } = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          let parsed = chunks;
          try {
            parsed = JSON.parse(chunks);
          } catch (_e) {
            /* leave as text */
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// 4. Assertion helper.
const checks = [];
function assert(name, condition, details = '') {
  checks.push({ name, pass: !!condition });
  console.log(`${condition ? '✅' : '❌'} ${name}${details ? `  — ${details}` : ''}`);
}

(async () => {
  // The non-default config means models/index.js needs to know about it.
  // Sync schema directly:
  await sequelize.sync({ force: true });

  const app = require('./server.js');
  const server = app.listen(0); // ephemeral port

  try {
    // --- POST /tags (twice) ---
    const tag1 = await request(server, 'POST', '/tags', { name: 'NodeJS' });
    const tag2 = await request(server, 'POST', '/tags', { name: 'Sequelize' });
    assert(
      'POST /tags returns 201 and lowercases the name',
      tag1.status === 201 &&
        tag1.body.name === 'nodejs' &&
        tag2.body.name === 'sequelize',
      `tag1=${JSON.stringify(tag1.body)}`
    );

   
    const userRes = await request(server, 'POST', '/users', {
      username: 'johndoe',
      email: 'john@example.com',
      profile: {
        bio: 'Software developer and blogger.',
        websiteUrl: 'myportfolio.com',
      },
    });
    assert(
      'POST /users returns 201 with the created user',
      userRes.status === 201 && userRes.body.username === 'johndoe'
    );
    assert(
      'POST /users persists profile with https:// prepended',
      userRes.body.profile?.websiteUrl === 'https://myportfolio.com',
      `got ${userRes.body.profile?.websiteUrl}`
    );

   
    const postRes = await request(server, 'POST', '/posts', {
      title: 'learning sequelize orm',
      content:
        'Sequelize is a promise-based Node.js ORM for Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server.',
      userId: userRes.body.id,
      tagIds: [tag1.body.id, tag2.body.id],
    });
   
    const { Post: PostModel } = require('./models');
    const created = await PostModel.findOne({
      where: { content: { [require('sequelize').Op.like]: 'Sequelize is%' } },
    });
    assert(
      'POST /posts persists post with Title-Cased title getter',
      !!created && created.title === 'Learning Sequelize Orm',
      `got "${created?.title}"`
    );
    const linkedTags = created ? await created.getTags() : [];
    assert(
      'POST /posts links tags via M:N',
      linkedTags.length === 2
    );

    // --- POST /posts validation: missing fields ---
    const bad = await request(server, 'POST', '/posts', { title: 'oops' });
    assert(
      'POST /posts returns 400 when required fields are missing',
      bad.status === 400
    );

   
    const ghost = await request(server, 'POST', '/posts', {
      title: 'a',
      content: 'b',
      userId: 9999,
    });
    assert(
      'POST /posts returns 404 for unknown userId',
      ghost.status === 404
    );

    console.log(
      '   (GET /posts and GET /users/:id skipped under pg-mem — verified in test.js)'
    );

    const passed = checks.filter((c) => c.pass).length;
    console.log(`\n--- HTTP: ${passed}/${checks.length} checks passed ---`);

    server.close();
    await sequelize.close();
    process.exit(passed === checks.length ? 0 : 1);
  } catch (err) {
    console.error('HTTP test threw:', err);
    server.close();
    process.exit(1);
  }
})();
