'use strict';

/**
 * Convert a string to Title Case.
 * "my first blog post" -> "My First Blog Post"
 */
function toTitleCase(str) {
  if (!str) return str;
  return String(str)
    .toLowerCase()
    .split(' ')
    .map((word) =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
    )
    .join(' ');
}

module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define(
    'Post',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Title cannot be empty' },
        },
     
        get() {
          const rawValue = this.getDataValue('title');
          return toTitleCase(rawValue);
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Content cannot be empty' },
        },
      },
    
      snippet: {
        type: DataTypes.VIRTUAL,
        get() {
          const content = this.getDataValue('content');
          if (!content) return '';
          return content.length > 60
            ? `${content.substring(0, 60)}...`
            : `${content}...`;
        },
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
    },
    {
      tableName: 'Posts',
      timestamps: true,

      defaultScope: {},
    }
  );

  Post.associate = (models) => {
    
    Post.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'author',
      onDelete: 'CASCADE',
    });

    
    Post.belongsToMany(models.Tag, {
      through: 'PostTags',
      foreignKey: 'postId',
      otherKey: 'tagId',
      as: 'tags',
      timestamps: false,
    });
  };

  return Post;
};
