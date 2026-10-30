/** @format */

const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const { loadLanguageFile } = require('@helpers');
const router = Router();

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
    const { languageCode = 'uk_UA', objects = [] } = req?.query ?? {};

    const p = path.resolve('languages', languageCode);
    const filesNames = [];
    const files = fs.readdirSync(p);

    files.forEach((file) => {
      filesNames.push(file);
    });

    const result = objects.reduce((acc, curr) => {
      acc[curr] = loadLanguageFile(
        filesNames.find((el) => new RegExp(`^${curr}-[a-z]+\.js`).test(el)),
        languageCode
      );
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
