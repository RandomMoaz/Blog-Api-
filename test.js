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


const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('test', 'test', 'test', {
  dialect: 'postgres',
  host: 'localhost',
  logging: false,
});


const User = require('./models/user.js')(sequelize, DataTypes);
const Profile = require('./models/profile.js')(sequelize, DataTypes);
const Post = require('./models/post.js')(sequelize, DataTypes);
const Tag = require('./models/tag.js')(sequelize, DataTypes);

const models = { User, Profile, Post, Tag };
Object.values(models).forEach((m) => m.associate && m.associate(models));


const checks = [];
function assert(name, condition, details = '') {
  checks.push({ name, pass: !!condition, details });
  const symbol = condition ? '✅' : '❌';
  console.log(`${symbol} ${name}${details ? `  — ${details}` : ''}`);
}

(async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('\n--- DB ready (pg-mem in-process Postgres) ---\n');

    
    const user = await User.create(
      {
        username: 'johndoe',
        email: 'john@example.com',
        profile: {
          bio: 'Software developer and blogger.',
          websiteUrl: 'myportfolio.com',
        },
      },
      { include: [{ model: Profile, as: 'profile' }] }
    );

    const fullUser = await User.findByPk(user.id, {
      include: [{ model: Profile, as: 'profile' }],
    });

    assert('User created with associated Profile (1:1)', !!fullUser.profile);
    assert(
      'Profile websiteUrl setter prepends https://',
      fullUser.profile.websiteUrl === 'https://myportfolio.com',
      `got "${fullUser.profile.websiteUrl}"`
    );

    const user2 = await User.create(
      {
        username: 'janedoe',
        email: 'jane@example.com',
        profile: { bio: 'Designer.', websiteUrl: 'https://janedoe.dev' },
      },
      { include: [{ model: Profile, as: 'profile' }] }
    );
    const jane = await User.findByPk(user2.id, {
      include: [{ model: Profile, as: 'profile' }],
    });
    assert(
      'Profile setter leaves https:// URLs unchanged',
      jane.profile.websiteUrl === 'https://janedoe.dev',
      `got "${jane.profile.websiteUrl}"`
    );

    const tagNode = await Tag.create({ name: 'NodeJS' });
    const tagSeq = await Tag.create({ name: 'Sequelize' });
    assert(
      'Tag name setter lowercases input',
      tagNode.name === 'nodejs' && tagSeq.name === 'sequelize',
      `got "${tagNode.name}", "${tagSeq.name}"`
    );

    const post = await Post.create({
      title: 'learning sequelize orm',
      content:
        'Sequelize is a promise-based Node.js ORM for Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server.',
      userId: fullUser.id,
    });
    await post.setTags([tagNode.id, tagSeq.id]);

    
    const posts = await Post.findAll({
      include: [{ model: User, as: 'author' }],
    });

    assert(
      'Post eager-loads its author (1:N inverse)',
      posts[0].author?.username === 'johndoe'
    );

    
    const linkedTags = await posts[0].getTags();
    assert(
      'Post is associated with both tags via M:N junction',
      linkedTags.length === 2 &&
        linkedTags
          .map((t) => t.name)
          .sort()
          .join(',') === 'nodejs,sequelize'
    );

   
    assert(
      'Post title getter returns Title Case',
      posts[0].title === 'Learning Sequelize Orm',
      `got "${posts[0].title}"`
    );

    
    const json = posts[0].toJSON();
    const expectedSnippet =
      'Sequelize is a promise-based Node.js ORM for Postgres, MySQL...';
    assert(
      'Post virtual `snippet` field is present in JSON',
      typeof json.snippet === 'string' && json.snippet.endsWith('...')
    );
    assert(
      'Post virtual `snippet` is first 60 chars + "..."',
      json.snippet === expectedSnippet,
      `got "${json.snippet}"`
    );

   
    const userWithPosts = await User.findByPk(fullUser.id, {
      include: [
        { model: Profile, as: 'profile' },
        { model: Post, as: 'posts' },
      ],
    });
    const tagsForBonus = userWithPosts.posts.length
      ? await userWithPosts.posts[0].getTags()
      : [];
    assert(
      'GET /users/:id includes profile + posts (and tags reachable per post)',
      !!userWithPosts.profile &&
        userWithPosts.posts?.length === 1 &&
        tagsForBonus.length === 2
    );

    const passed = checks.filter((c) => c.pass).length;
    const total = checks.length;
    console.log(`\n--- ${passed}/${total} checks passed ---`);

    await sequelize.close();
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test run threw:', err);
    process.exit(1);
  }
})();
