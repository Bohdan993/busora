/** @format */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { user: User } = require('@database/models/index');
const { sendActivationMail } = require('@services/mailService');
const {
  generateTokens,
  saveToken,
  removeToken,
  validateRefreshToken,
  findToken
} = require('@services/tokenService');
const AdminAPIError = require('@exeptions/admin/api-error');

async function registration(email, password, name, deviceFingerprint) {
  const candidate = await User.findOne({
    where: {
      [Op.and]: [
        { email: email },
        {
          password: {
            [Op.not]: null
          }
        }
      ]
    }
  });

  if (candidate) {
    throw AdminAPIError.BadRequestError('Помилка', [
      `Користувач з такою email адресою ${email} уже існує`
    ]);
  }

  const hashedPassword = await bcrypt.hash(password, 5);
  const activationLink = uuidv4();
  const user = await User.create({
    name,
    password: hashedPassword,
    email,
    activationLink
  });
  await sendActivationMail(
    email,
    `${process.env.API_URL}/admin/auth/activate/${activationLink}`
  );
  const userData = {
    id: user?.id,
    name: user?.name,
    email: user?.email,
    isActivated: !!user?.isActivated,
    role: user?.role,
    dateOfBirth: user?.dateOfBirth,
    phone: user?.phone,
    isBlocked: !!user?.isBlocked
  };
  const tokens = generateTokens(userData);
  await saveToken(userData?.id, tokens?.refreshToken, deviceFingerprint);

  return {
    ...tokens,
    user: userData
  };
}

async function activation(activationLink) {
  const user = await User.findOne({
    where: {
      activationLink: activationLink
    }
  });

  if (!user) {
    throw AdminAPIError.BadRequestError('Помилка', [
      'Некоректне посилання активації'
    ]);
  }

  if (user.isActivated) {
    throw AdminAPIError.BadRequestError('Помилка', [
      'Посилання для активації уже використане'
    ]);
  }

  user.isActivated = true;
  await user.save();
}

async function login(email, password, deviceFingerprint) {
  const candidate = await User.findOne({
    where: {
      [Op.and]: [
        { email: email },
        {
          password: {
            [Op.not]: null
          }
        }
      ]
    }
  });

  if (!candidate) {
    throw AdminAPIError.BadRequestError('Помилка', [
      `Користувача з такою email адресою ${email} не існує`
    ]);
  }

  if (candidate?.isBlocked) {
    throw AdminAPIError.ForbiddenError('Доступ заборонено', [
      `Користувача заблоковано`
    ]);
  }

  const isPasswordEquals = await bcrypt.compare(password, candidate?.password);

  if (!isPasswordEquals) {
    throw AdminAPIError.BadRequestError('Помилка', [`Невірний пароль`]);
  }

  const userData = {
    id: candidate?.id,
    name: candidate?.name,
    email: candidate?.email,
    isActivated: !!candidate?.isActivated,
    role: candidate?.role,
    dateOfBirth: candidate?.dateOfBirth,
    phone: candidate?.phone,
    isBlocked: !!candidate?.isBlocked
  };
  const tokens = generateTokens(userData);

  await saveToken(userData?.id, tokens?.refreshToken, deviceFingerprint);

  return {
    ...tokens,
    user: userData
  };
}

async function logout(refreshToken) {
  const token = await removeToken(refreshToken);
  return token;
}

async function refresh(refreshToken, deviceFingerprint) {
  if (!refreshToken) {
    throw AdminAPIError.UnauthorizedError();
  }
  const userData = validateRefreshToken(refreshToken);
  const tokenFromDb = await findToken(refreshToken);

  if (!userData || !tokenFromDb) {
    throw AdminAPIError.UnauthorizedError();
  }

  const user = await User.findByPk(userData?.id);

  if (user?.isBlocked) {
    throw AdminAPIError.ForbiddenError('Доступ заборонено', [
      `Користувача заблоковано`
    ]);
  }

  const userDataObj = {
    id: user?.id,
    name: user?.name,
    email: user?.email,
    isActivated: !!user?.isActivated,
    role: user?.role,
    dateOfBirth: user?.dateOfBirth,
    phone: user?.phone,
    isBlocked: !!user?.isBlocked
  };

  const tokens = generateTokens(userDataObj);

  await saveToken(userDataObj?.id, tokens?.refreshToken, deviceFingerprint);

  return {
    ...tokens,
    user: userData
  };
}

module.exports = {
  registration,
  activation,
  login,
  logout,
  refresh
};
