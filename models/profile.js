'use strict';

module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define(
    'Profile',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      websiteUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        
        set(value) {
          if (!value) {
            this.setDataValue('websiteUrl', value);
            return;
          }
          const trimmed = String(value).trim();
          if (/^https?:\/\//i.test(trimmed)) {
            this.setDataValue('websiteUrl', trimmed);
          } else {
            this.setDataValue('websiteUrl', `https://${trimmed}`);
          }
        },
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
    },
    {
      tableName: 'Profiles',
      timestamps: true,
    }
  );

  Profile.associate = (models) => {
    // Belongs to one User
    Profile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  return Profile;
};
