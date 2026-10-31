/** @format */

const { Router } = require('express');
const { language: Language } = require('@database/models/index');
const {
  findPersonalDiscounts,
  toPassengerFormDiscounts
} = require('@services/discountService');
const { DEFAULT_LOCALE } = require('@root/config/market');

const router = Router();

/**
 * @swagger
 * /api/discounts:
 *   get:
 *     summary: Personal discounts, for the fares page
 *     description: >
 *       Every personal discount, including those that are seasonally inactive
 *       today (their name says when). Booking offers only the currently valid
 *       ones, via GET /api/passengers.
 *     tags: [Network]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema:
 *           $ref: '#/components/schemas/LanguageCode'
 *     responses:
 *       200:
 *         description: Discounts by passenger group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiscountsResponse'
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
    const language = await Language.findOne({ where: { code: languageCode } });
    const discounts = await findPersonalDiscounts(language?.id);
    return res.json({
      status: 'ok',
      data: toPassengerFormDiscounts(discounts)
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
