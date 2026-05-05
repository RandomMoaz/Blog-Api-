'use strict';

const { Tag } = require('../models');


exports.createTag = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const tag = await Tag.create({ name });
    return res.status(201).json(tag);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res
        .status(409)
        .json({ error: 'A tag with this name already exists' });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors?.map((e) => e.message),
      });
    }
    console.error('createTag error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /tags
 */
exports.getAllTags = async (req, res) => {
  try {
    const tags = await Tag.findAll({ order: [['id', 'ASC']] });
    return res.json(tags);
  } catch (err) {
    console.error('getAllTags error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
