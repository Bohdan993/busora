/** @format */

const { Router } = require('express');
const router = Router();
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
 *     summary: Cities grouped by country
 *     description: Only cities that have a name in the requested language are listed.
 *     tags: [Cities]
 *     parameters:
 *       - in: query
 *         name: languageCode
 *         schema:
 *           $ref: '#/components/schemas/LanguageCode'
 *       - in: query
 *         name: excludedCountry
 *         schema: { type: integer }
 *         description: Leave out this country's cities
 *     responses:
 *       200:
 *         description: Cities by country
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CitiesResponse'
 *       400:
 *         description: Unknown language code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res, next) => {
  try {
    let cities = [];

    const { languageCode = 'uk_UA', excludedCountry = null } = req?.query ?? {};

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

    return res.json({
      status: 'ok',
      data: mapCities(cities)
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
