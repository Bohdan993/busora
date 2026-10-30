/** @format */

const { Router } = require('express');
const { Op } = require('sequelize');
const constants = require('@helpers/constants.js');
const {
  discount: Discount,
  discountattributes: DiscountAttributes
} = require('@database/models/index');
const {
  checkUserPermissions,
  checkUserAuth,
  checkUserActivation,
  checkUserBlocked
} = require('@middlewares/admin/authMiddlewares');
const router = Router();

/**
 * @swagger
 * /api/admin/discounts:
 *   get:
 *     summary: List all discounts
 *     description: >
 *       Returns all discount types (student, pensioner, child, etc.) plus a
 *       synthetic "No discount" entry with `id: "0"`. Used to populate discount
 *       dropdowns in the admin ticket form.
 *     tags: [Admin / Discounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Discount list
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
 *                       id: { type: string, example: "5" }
 *                       coef: { type: number, example: 0.9 }
 *                       group: { type: string, example: "students" }
 *                       label: { type: string, example: "Студентська" }
 *                       value: { type: string }
 *                       name: { type: string }
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
      let discounts = [];
      let query = {
        attributes: ['id', 'coef', 'group'],
        where: {},
        include: [
          {
            model: DiscountAttributes,
            as: 'discountattrs',
            attributes: ['name'],
            where: {
              languageId: {
                [Op.eq]: 1
              }
            }
          }
        ],
        order: [['id', 'ASC']]
      };

      const { count, rows } = await Discount.findAndCountAll(query);
      discounts = rows?.map((discount) => discount?.toJSON());

      return res.json({
        status: 'ok',
        data: [
          {
            id: '0',
            coef: 0,
            group: constants.BOTH,
            label: 'Без знижки',
            value: 'Без знижки',
            name: 'Без знижки'
          },
          ...discounts.map((discount) => {
            return {
              id: String(discount?.id),
              coef: discount?.coef,
              group: discount?.group,
              label: discount?.discountattrs?.[0]?.name,
              value: discount?.discountattrs?.[0]?.name,
              name: discount?.discountattrs?.[0]?.name
            };
          })
        ],
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
