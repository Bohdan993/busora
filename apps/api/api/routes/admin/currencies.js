/** @format */

const { Router } = require('express');
const constants = require('@helpers/constants.js');
const { currency: Currency } = require('@database/models/index');
const {
  checkUserPermissions,
  checkUserAuth,
  checkUserActivation,
  checkUserBlocked
} = require('@middlewares/admin/authMiddlewares');
const router = Router();

router.get(
  '/',
  [
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE, constants.MANAGER_ROLE)
  ],
  async (req, res, next) => {
    try {
      let currencies = [];
      let query = {
        attributes: ['id', 'abbr'],
        where: {},
        order: [['id', 'ASC']]
      };

      const { count, rows } = await Currency.findAndCountAll(query);
      currencies = rows?.map((currency) => currency?.toJSON());

      return res.json({
        status: 'ok',
        data: currencies.map((currency) => {
          return {
            id: String(currency?.id),
            label: currency?.abbr,
            value: currency?.abbr
          };
        }),
        meta: {
          totalRowCount: count || 0
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
