/** @format */

const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { token: Token } = require('@database/models/index');

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET_ACCESS, {
    expiresIn: '30m'
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET_REFRESH, {
    expiresIn: '30d'
  });

  return {
    accessToken,
    refreshToken
  };
}

async function saveToken(userId, refreshToken, deviceFingerprint) {
  const tokenData = await Token.findOne({
    where: {
      [Op.and]: [{ userId: userId }, { deviceFingerprint: deviceFingerprint }]
    }
  });

  if (tokenData) {
    tokenData.refreshToken = refreshToken;
    return await tokenData.save();
  }

  const token = await Token.create({
    userId,
    refreshToken,
    deviceFingerprint
  });

  return token;
}

async function removeToken(refreshToken) {
  const tokenData = await Token.destroy({
    where: { refreshToken: refreshToken || '' }
  });
  return tokenData;
}

async function findToken(refreshToken) {
  const tokenData = await Token.findOne({
    where: { refreshToken: refreshToken || '' }
  });
  return tokenData;
}

function validateAccessToken(token) {
  try {
    const userData = jwt.verify(token, process.env.JWT_SECRET_ACCESS);
    return userData;
  } catch (err) {
    return null;
  }
}

function validateRefreshToken(token) {
  try {
    const userData = jwt.verify(token, process.env.JWT_SECRET_REFRESH);
    return userData;
  } catch (err) {
    return null;
  }
}

async function deleteExpiredTokens() {}

module.exports = {
  generateTokens,
  saveToken,
  removeToken,
  findToken,
  validateRefreshToken,
  validateAccessToken
};
