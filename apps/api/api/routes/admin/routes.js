/** @format */

const { Router } = require('express');

const { Op } = require('sequelize');
// const { body, validationResult, param } = require("express-validator");
// const AdminAPIError = require("../../../exeptions/admin/api-error");
const constants = require('@helpers/constants.js');
const {
  route: Route,
  // busflight: BusFlight,
  routeattributes: RouteAttributes,
  // discount: Discount,
  country: County,
  countryattributes: CountryAttributes
} = require('@database/models/index');
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
      let routes = [];

      let query = {
        attributes: ['id'],
        where: {},
        include: [
          {
            model: RouteAttributes,
            as: 'routeattrs',
            attributes: ['name'],
            where: {
              languageId: {
                [Op.eq]: 1
              }
            }
          },
          {
            model: County,
            attributes: ['id'],
            include: [
              {
                model: CountryAttributes,
                as: 'countryattrs',
                attributes: ['name'],
                where: {
                  languageId: {
                    [Op.eq]: 1
                  }
                }
              }
            ]
          }
        ]
      };

      const { count, rows } = await Route.findAndCountAll(query);

      routes = rows?.map((route) => route?.toJSON());

      return res.json({
        status: 'ok',
        data: routes.map((el) => ({
          id: String(el?.id),
          label: el?.routeattrs?.[0]?.name || '',
          countryId: el?.country?.id
            ? el?.country?.id
            : String(el?.country?.id),
          groupBy: el?.country?.countryattrs?.[0]?.name || ''
        })),
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
