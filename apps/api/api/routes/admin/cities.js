/** @format */

const { Router } = require('express');
const router = Router();
// const sequelize = require("../../../database/models/index").sequelize;
const { Op } = require('sequelize');
const constants = require('@helpers/constants.js');
const {
  city: City,
  cityattributes: CityAttributes,
  country: Country,
  countryattributes: CountryAttributes,
  routecityorder: RouteCityOrder
} = require('@database/models/index');
const {
  checkUserPermissions,
  checkUserAuth,
  checkUserActivation,
  checkUserBlocked
} = require('@middlewares/admin/authMiddlewares');

/**
 * Builds a `cityId -> sorting` lookup from the routecityorders rows. Each city
 * gets one `{ <forward>: pos, <reverse>: pos }` object per line it appears on,
 * ordered by lineGroup. Rows must already be ordered by (lineGroup, position).
 */
function buildSortingByCity(orderRows) {
  const byCity = new Map();

  for (const row of orderRows) {
    const { cityId, lineGroup, routeKey, position } = row;
    if (!byCity.has(cityId)) byCity.set(cityId, new Map());
    const groups = byCity.get(cityId);
    if (!groups.has(lineGroup)) groups.set(lineGroup, {});
    groups.get(lineGroup)[routeKey] = position;
  }

  return (cityId) => {
    const groups = byCity.get(cityId);
    if (!groups) return [];
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, obj]) => obj);
  };
}

/**
 * @swagger
 * /api/admin/cities:
 *   get:
 *     summary: List all cities with their route assignments
 *     description: Returns cities enriched with the routes they appear on (as onboarding or outboarding stop) and their sort order within each route.
 *     tags: [Admin / Cities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: City list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, example: "1" }
 *                       label: { type: string, example: "Київ" }
 *                       value: { type: string, example: "Київ" }
 *                       groupBy: { type: string, example: "Україна" }
 *                       countryId: { type: string, example: "2" }
 *                       sorting:
 *                         type: array
 *                         items: { type: object }
 *                         description: Per-route sort-index map
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalRowCount: { type: integer }
 *       401:
 *         description: Unauthorized
 */
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
      const query = {
        attributes: ['id'],
        where: {},
        include: [
          {
            model: CityAttributes,
            as: 'cityattrs',
            attributes: ['name'],
            where: {
              languageId: {
                [Op.eq]: 1
              }
            }
          },
          {
            model: Country,
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

      const [{ count, rows }, orderRows] = await Promise.all([
        City.findAndCountAll(query),
        RouteCityOrder.findAll({
          attributes: ['lineGroup', 'routeKey', 'cityId', 'position'],
          order: [
            ['lineGroup', 'ASC'],
            ['position', 'ASC']
          ],
          raw: true
        })
      ]);

      const sortingFor = buildSortingByCity(orderRows);
      const cities = rows?.map((city) => city?.toJSON());

      return res.json({
        status: 'ok',
        data: cities.map((el) => {
          const name = el?.cityattrs?.[0]?.name || '';
          return {
            id: String(el?.id),
            label: name,
            value: name,
            groupBy: el?.country?.countryattrs?.[0]?.name || '',
            countryId: el?.country?.id ? String(el?.country?.id) : '',
            sorting: sortingFor(el?.id)
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
