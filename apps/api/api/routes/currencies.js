/** @format */

const { Router } = require('express');
const router = Router();
const { Op } = require('sequelize');
const { currency: Currency } = require('@database/models/index');
const APIError = require('@exeptions/api-error');
const { query, validationResult } = require('express-validator');

/** Columns a caller is permitted to request. "id" is always included. */
const ALLOWED_FIELDS = new Set(['name', 'abbr', 'symbol']);

/** Valid ISO 4217-style abbreviation: 2-4 uppercase letters */
const ABBR_REGEX = /^[A-Z]{2,4}$/;

/** Maximum number of abbreviations per request */
const MAX_ABBRS = 10;

/**
 * @swagger
 * /api/currencies:
 *   get:
 *     summary: Get currencies by abbreviation
 *     tags: [Currencies]
 *     parameters:
 *       - in: query
 *         name: currencyAbbr
 *         required: true
 *         schema:
 *           type: string
 *           example: UAH,EUR
 *         description: Comma-separated ISO 4217 currency codes (max 10). Repeated array format also accepted.
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *           example: name,abbr,symbol
 *         description: "Comma-separated extra fields to include (allowed: name, abbr, symbol). id is always returned."
 *     responses:
 *       200:
 *         description: Matching currency records
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
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Гривня
 *                       abbr:
 *                         type: string
 *                         example: UAH
 *                       symbol:
 *                         type: string
 *                         example: ₴
 *       400:
 *         description: Validation error (missing or invalid abbreviation)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  query('currencyAbbr')
    .notEmpty()
    .withMessage('currencyAbbr query parameter is required'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw APIError.ValidationError('validation error', errors.array());
      }
      const { currencyAbbr, fields } = req?.query ?? {};

      // Normalise: accept both "UAH,EUR" and repeated "currencyAbbr[]=UAH"
      const rawAbbrs = Array.isArray(currencyAbbr)
        ? currencyAbbr
        : String(currencyAbbr).split(',');

      const abbrs = rawAbbrs.map((a) => a.trim().toUpperCase()).filter(Boolean);

      if (abbrs.length > MAX_ABBRS) {
        throw APIError.BadRequestError(
          `Too many abbreviations requested (max ${MAX_ABBRS})`
        );
      }

      const invalidAbbrs = abbrs.filter((a) => !ABBR_REGEX.test(a));
      if (invalidAbbrs.length) {
        throw APIError.ValidationError('Invalid currency abbreviation(s)', [
          `The following values are not valid currency codes: ${invalidAbbrs.join(', ')}`
        ]);
      }

      // ── Validate extra fields ──────────────────────────────────────────────
      let extraFields = [];

      if (fields !== undefined) {
        const rawFields = Array.isArray(fields)
          ? fields
          : String(fields).split(',');

        extraFields = rawFields.map((f) => f.trim()).filter(Boolean);

        const disallowed = extraFields.filter((f) => !ALLOWED_FIELDS.has(f));
        if (disallowed.length) {
          throw APIError.ValidationError('Invalid field name(s) requested', [
            `Allowed fields: ${[...ALLOWED_FIELDS].join(', ')}. Unknown: ${disallowed.join(', ')}`
          ]);
        }
      }

      // ── Query ──────────────────────────────────────────────────────────────
      const currencies = await Currency.findAll({
        attributes: ['id', ...extraFields],
        where: {
          abbr: {
            [Op.in]: abbrs
          }
        }
      });

      return res.json({
        status: 'ok',
        data: currencies
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
