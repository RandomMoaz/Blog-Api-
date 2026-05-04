'use strict';

module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define(
    'Tag',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: { msg: 'Tag name cannot be empty' },
        },
        // Setter: convert to lowercase before saving
        set(value) {
          if (value === null || value === undefined) {
            this.setDataValue('name', value);
            return;
          }
          this.setDataValue('name', String(value).trim().toLowerCase());
        },
      },
    },
    {
      tableName: 'Tags',
      timestamps: true,
    }
  );

  Tag.associate = (models) => {
    
    Tag.belongsToMany(models.Post, {
      through: 'PostTags',
      foreignKey: 'tagId',
      otherKey: 'postId',
      as: 'posts',
      timestamps: false,
    });
  };

  return Tag;
};
