/** @format */

const { Router } = require('express');
const { getNetwork } = require('@services/networkService');
const { DEFAULT_LOCALE } = require('@root/config/market');

const router = Router();

// The network changes only when flights are re-seeded or edited in the admin
const CACHE_SECONDS = 300;

/**
 * @swagger
 * /api/network:
 *   get:
 *     summary: The bus network for the routes, schedule and fares pages
 *     description: >
 *       Cities, the lines with both directions (stops, times, the weekdays they
 *       run) and every fare in UAH and CZK. Public and cacheable; it does not
 *       touch the booking session.
 *     tags: [Network]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema:
 *           $ref: '#/components/schemas/LanguageCode'
 *     responses:
 *       200:
 *         description: The network
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NetworkResponse'
 *       400:
 *         description: Unknown language code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res, next) => {
  try {
    const { languageCode = DEFAULT_LOCALE } = req.query;
    const data = await getNetwork(languageCode);
    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    return res.json({ status: 'ok', data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
