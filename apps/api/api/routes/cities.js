/** @format */

const { Router } = require('express');
const router = Router();
const pug = require('pug');
const path = require('path');
const { Op } = require('sequelize');
const {
  country: Country,
  countryattributes: CountryAttributes,
  currency: Currency,
  language: Language,
  cityattributes: CityAttributes,
  city: City
} = require('@database/models/index');
const APIError = require('@exeptions/api-error');

function mapCities(cities) {
  let uniq = {};
  cities.forEach((city) => {
    uniq[city?.country?.countryattrs?.[0]?.name] = city?.country;
  });
  let arr = Object.values(uniq);
  let resultCities = arr.map((el) => {
    return {
      country: el,
      cities: [...cities.filter((city) => city?.country?.id === el?.id)]
    };
  });

  return resultCities;
}

/**
 * @swagger
 * /api/cities:
 *   get:
 *     summary: Get all cities grouped by country
 *     tags: [Cities]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *           example: uk_UA
 *         description: Language code for localised city/country names (default uk_UA)
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [html, json]
 *           default: html
 *         description: Response format — `html` returns a rendered Pug dropdown, `json` returns plain data
 *       - in: query
 *         name: excludedCountry
 *         schema:
 *           type: integer
 *         description: Country ID to exclude from results
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
 *                   oneOf:
 *                     - type: string
 *                       description: Rendered HTML dropdown (mode=html)
 *                     - type: array
 *                       description: Structured city/country list (mode=json)
 *                       items:
 *                         type: object
 *                         properties:
 *                           country:
 *                             type: object
 *                           cities:
 *                             type: array
 *                             items:
 *                               type: object
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res, next) => {
  try {
    let cities = [];

    const {
      languageCode = 'uk_UA',
      mode = 'html',
      excludedCountry = null
    } = req?.query ?? {};

    const lang = await Language.findOne({
      where: {
        code: {
          [Op.eq]: languageCode
        }
      }
    });

    if (!lang) {
      throw APIError.BadRequestError(`Unknown language code: ${languageCode}`);
    }

    cities = await City.findAll({
      attributes: ['id'],
      include: [
        // {
        //     model: Language,
        //     where: {
        //         code: {
        //             [Op.eq]: lang?.id
        //         }
        //     },
        //     attributes: ["name", "code"],
        //     through: {
        //         attributes: []
        //     }
        // },
        {
          model: Country,
          attributes: ['id'],
          where: {
            id: {
              [Op.ne]: excludedCountry
            }
          },
          include: [
            {
              model: CountryAttributes,
              as: 'countryattrs',
              attributes: ['name', 'countryId', 'languageId'],
              where: {
                languageId: {
                  [Op.eq]: lang?.id
                }
              }
            }
          ]
        },
        {
          model: CityAttributes,
          as: 'cityattrs',
          attributes: ['name', 'cityId', 'languageId'],
          where: {
            languageId: {
              [Op.eq]: lang?.id
            }
          }
        },
        {
          model: Currency,
          attributes: ['abbr', 'symbol']
        }
      ],
      order: [
        [
          { model: Country },
          { model: CountryAttributes, as: 'countryattrs' },
          'name',
          'DESC'
        ],
        [{ model: CityAttributes, as: 'cityattrs' }, 'name', 'ASC']
      ]
    });

    cities = cities?.map((city) => city?.toJSON());
    const resultCities = mapCities(cities);

    if (mode?.toLowerCase() === 'json') {
      return res.json({
        status: 'ok',
        data: resultCities
      });
    }

    // Default to HTML for any non-json mode so an unrecognised `mode` value
    // never leaves the request hanging without a response.
    const template = path.resolve('views', 'cities-dropdown.pug');
    const html = pug.renderFile(template, { data: resultCities });
    return res.json({
      status: 'ok',
      data: html
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
