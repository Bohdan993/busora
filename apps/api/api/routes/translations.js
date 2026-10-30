/** @format */

const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const { loadLanguageFile } = require('@helpers');
const APIError = require('@exeptions/api-error');
const router = Router();

const OBJECT_NAME_PATTERN = /^[a-z]+$/;

/**
 * @swagger
 * /api/translations:
 *   get:
 *     summary: Get localisation string bundles
 *     description: >
 *       Returns one or more translation objects for the requested language.
 *       Pass the `objects` query parameter to specify which translation files
 *       to load (e.g. `ticket-list`, `passengers-form`).
 *     tags: [Translations]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, default: uk_UA }
 *         description: Language code (must match a folder under `/languages/`)
 *       - in: query
 *         name: objects
 *         style: form
 *         explode: true
 *         schema:
 *           type: array
 *           items: { type: string }
 *           example: [ticket-list, passengers-form]
 *         description: Translation file keys to load (matched against filenames like `{key}-*.js`)
 *     responses:
 *       200:
 *         description: Map of requested translation bundles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                   example:
 *                     ticket-list:
 *                       months: ["Січня", "Лютого"]
 */
router.get('/', async (req, res, next) => {
  try {
    // languageCode is validated by validateLanguageCode before this route
    const { languageCode = 'uk_UA', objects = [] } = req?.query ?? {};

    // Object names are interpolated into a RegExp below, so only plain
    // lowercase words are accepted.
    if (
      !Array.isArray(objects) ||
      !objects.every((name) => OBJECT_NAME_PATTERN.test(name))
    ) {
      throw APIError.BadRequestError('objects must be lowercase names');
    }

    const filesNames = fs.readdirSync(path.resolve('languages', languageCode));

    const result = objects.reduce((acc, curr) => {
      const fileName = filesNames.find((el) =>
        new RegExp(`^${curr}-[a-z]+\\.js$`).test(el)
      );
      if (!fileName) {
        throw APIError.BadRequestError(`unknown translation object: ${curr}`);
      }
      acc[curr] = loadLanguageFile(fileName, languageCode);
      return acc;
    }, {});

    return res.json({
      status: 'ok',
      data: result
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
