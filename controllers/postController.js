'use strict';

const { Post, User, Tag, sequelize } = require('../models');


exports.createPost = async (req, res) => {
  const t = await sequelize.transaction();
  let committed = false;
  try {
    const { title, content, userId, tagIds } = req.body;

    if (!title || !content || !userId) {
      await t.rollback();
      return res
        .status(400)
        .json({ error: 'title, content, and userId are required' });
    }

    // Verify the user exists
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return res
        .status(404)
        .json({ error: `User with id ${userId} not found` });
    }

    // Create the post
    const post = await Post.create(
      { title, content, userId },
      { transaction: t }
    );

    // Link tags via the junction table (Many-to-Many)
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const tags = await Tag.findAll({
        where: { id: tagIds },
        transaction: t,
      });

      if (tags.length !== tagIds.length) {
        await t.rollback();
        const foundIds = tags.map((tag) => tag.id);
        const missing = tagIds.filter((id) => !foundIds.includes(id));
        return res.status(404).json({
          error: 'One or more tagIds were not found',
          missingTagIds: missing,
        });
      }

      await post.setTags(tags, { transaction: t });
    }

    await t.commit();
    committed = true;

  
    const created = await Post.findByPk(post.id, {
      include: [
        { model: User, as: 'author' },
        { model: Tag, as: 'tags', through: { attributes: [] } },
      ],
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
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors?.map((e) => e.message),
      });
    }
    console.error('createPost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        { model: User, as: 'author' },
        { model: Tag, as: 'tags', through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json(posts);
  } catch (err) {
    console.error('getAllPosts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /posts/:id
 */
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        { model: User, as: 'author' },
        { model: Tag, as: 'tags', through: { attributes: [] } },
      ],
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json(post);
  } catch (err) {
    console.error('getPostById error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
