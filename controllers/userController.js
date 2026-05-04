'use strict';

const { User, Profile, Post, Tag, sequelize } = require('../models');


exports.createUser = async (req, res) => {
  const t = await sequelize.transaction();
  let committed = false;
  try {
    const { username, email, profile } = req.body;

    if (!username || !email) {
      await t.rollback();
      return res
        .status(400)
        .json({ error: 'username and email are required' });
    }

   
    const user = await User.create(
      {
        username,
        email,
        profile: profile || undefined,
      },
      {
        include: [{ model: Profile, as: 'profile' }],
        transaction: t,
      }
    );

    await t.commit();
    committed = true;

    
    const created = await User.findByPk(user.id, {
      include: [{ model: Profile, as: 'profile' }],
    });

    return res.status(201).json(created);
  } catch (err) {
    if (!committed) {
      try {
        await t.rollback();
      } catch (_rollbackErr) {
        // already finished
      }
    }
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'A user with this username or email already exists',
        details: err.errors?.map((e) => e.message),
      });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors?.map((e) => e.message),
      });
    }
    console.error('createUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Profile, as: 'profile' }],
      order: [['id', 'ASC']],
    });
    return res.json(users);
  } catch (err) {
    console.error('getAllUsers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      include: [
        { model: Profile, as: 'profile' },
        {
          model: Post,
          as: 'posts',
          include: [
            {
              model: Tag,
              as: 'tags',
              through: { attributes: [] }, // hide junction-table fields
            },
          ],
        },
      ],
      order: [[{ model: Post, as: 'posts' }, 'createdAt', 'DESC']],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    console.error('getUserById error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};