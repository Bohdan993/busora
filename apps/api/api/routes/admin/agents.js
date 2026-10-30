/** @format */

const { Router } = require('express');
const { Op } = require('sequelize');
const constants = require('@helpers/constants.js');
const {
  agent: Agent,
  agentattributes: AgentAttributes
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
 * /api/admin/agents:
 *   get:
 *     summary: List all agents
 *     description: >
 *       Returns all agents plus a synthetic "No agent" entry with `id: "0"`.
 *       Used to populate agent dropdowns in the admin ticket form.
 *     tags: [Admin / Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent list
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
 *                       label: { type: string, example: "Нестерова" }
 *                       value: { type: string, example: "Нестерова" }
 *                       name: { type: string, example: "Нестерова" }
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
      const { count, rows } = await Agent.findAndCountAll({
        attributes: ['id'],
        include: [
          {
            model: AgentAttributes,
            as: 'agentattrs',
            attributes: ['name'],
            where: { languageId: { [Op.eq]: 1 } }
          }
        ],
        order: [['id', 'ASC']]
      });

      const agents = rows.map((a) => a.toJSON());

      return res.json({
        status: 'ok',
        data: [
          {
            id: '0',
            label: 'Без агента',
            value: 'Без агента',
            name: 'Без агента'
          },
          ...agents.map((agent) => ({
            id: String(agent.id),
            label: agent.agentattrs?.[0]?.name,
            value: agent.agentattrs?.[0]?.name,
            name: agent.agentattrs?.[0]?.name
          }))
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
