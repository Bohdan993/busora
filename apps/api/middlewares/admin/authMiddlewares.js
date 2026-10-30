/** @format */

const AdminAPIError = require('@exeptions/admin/api-error');
const { validateAccessToken } = require('@services/tokenService');
const { user: User } = require('@database/models/index');

async function checkUserAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw AdminAPIError.UnauthorizedError();
    }
    const accessToken = authHeader.split(' ')[1];

    if (!accessToken) {
      throw AdminAPIError.UnauthorizedError();
    }
    const userData = validateAccessToken(accessToken);

    if (!userData) {
      throw AdminAPIError.UnauthorizedError();
    }

    const user = await User.findByPk(userData?.id);

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

    req.user = userDataObj;
    return next();
  } catch (err) {
    return next(err);
  }
}

function checkUserPermissions(...permittedRoles) {
  // return a middleware
  return (req, res, next) => {
    try {
      const { user } = req;

      if (user && permittedRoles.includes(user.role)) {
        return next(); // role is allowed, so continue on the next middleware
      }

      throw AdminAPIError.ForbiddenError('Доступ заборонено', [
        `Недостатньо прав!`
      ]);
    } catch (err) {
      return next(err);
    }
  };
}

function checkUserActivation(req, res, next) {
  const { user } = req;

  if (user?.isActivated) {
    return next();
  }

  throw AdminAPIError.ForbiddenError('Доступ заборонено', [
    `Потрібно підтвердити активацію!`
  ]);
}

function checkUserBlocked(req, res, next) {
  const { user } = req;

  if (!user?.isBlocked) {
    return next();
  }

  throw AdminAPIError.ForbiddenError('Доступ заборонено', [
    `Користувача заблоковано!`
  ]);
}

module.exports = {
  checkUserAuth,
  checkUserActivation,
  checkUserPermissions,
  checkUserBlocked
};
