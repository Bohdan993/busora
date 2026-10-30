/** @format */

const { Router } = require('express');
const { Op } = require('sequelize');
const { body, validationResult, param, query } = require('express-validator');
const sequelize = require('@database/models/index').sequelize;
const AdminAPIError = require('@exeptions/admin/api-error');
const constants = require('@helpers/constants.js');
const {
  route: Route,
  busflight: BusFlight,
  routeattributes: RouteAttributes,
  discount: Discount,
  country: County,
  countryattributes: CountryAttributes
} = require('@database/models/index');
const {
  checkUserPermissions,
  checkUserAuth,
  checkUserActivation,
  checkUserBlocked
} = require('@middlewares/admin/authMiddlewares');
const { transformStringToConstant } = require('@helpers');
const queryHelper = require('@helpers/queries');
const {
  transformBusFlightsTableKey,
  hasActualDiscount,
  getAvailableDates
} = require('@services/busFlightService');
const router = Router();

/**
 * @swagger
 * /api/admin/bus-flights:
 *   get:
 *     summary: List bus flights (paginated, filterable, sortable)
 *     tags: [Admin / Bus Flights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema: { type: integer, example: 0 }
 *         description: Row offset (pagination)
 *       - in: query
 *         name: size
 *         required: true
 *         schema: { type: integer, example: 10 }
 *         description: Page size
 *       - in: query
 *         name: filters
 *         required: true
 *         schema: { type: string, example: "[]" }
 *         description: JSON-serialised filter array `[{id, value}]`
 *       - in: query
 *         name: filtersFns
 *         required: true
 *         schema: { type: string, example: "[]" }
 *         description: "JSON-serialised filter-function map {fieldId: fnName}"
 *       - in: query
 *         name: sorting
 *         required: true
 *         schema: { type: string, example: "[]" }
 *         description: JSON-serialised sort array `[{id, desc}]`
 *     responses:
 *       200:
 *         description: Paginated bus-flight list
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
 *                     $ref: '#/components/schemas/BusFlightTableRow'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  [
    query('start').isInt(),
    query('size').isInt(),
    query('filters').isString(),
    query('filtersFns').isString(),
    query('sorting').isString(),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE, constants.MANAGER_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      let busFlights = [];

      const {
        start = 0,
        size = 5,
        filters = '[]',
        filtersFns = '[]',
        sorting = '[]'
      } = req?.query ?? {};

      const parsedFilters = JSON.parse(filters);
      const parsedFiltersFns = JSON.parse(filtersFns);
      const parsedSorting = JSON.parse(sorting);
      let parsedFiltersWithFns = [];

      if (parsedFilters.length) {
        parsedFiltersWithFns = parsedFilters
          ?.filter((el) => !!el?.value)
          ?.map((el) => {
            return {
              id: el?.id,
              value: Array.isArray(el?.value)
                ? el?.value?.filter(Boolean)?.length > 0
                  ? el?.value
                  : []
                : el?.value,
              fn: parsedFiltersFns?.[el?.id] || ''
            };
          });
      }

      let routeAttributesQuery = {
        model: RouteAttributes,
        as: 'routeattrs',
        attributes: ['name'],
        where: {
          languageId: {
            [Op.eq]: 1
          }
        }
      };

      let routeQuery = {
        model: Route,
        include: []
      };

      let discountQuery = {
        model: Discount,
        attributes: ['id', 'coef', 'busflightId', 'group']
      };

      let query = {
        attributes: [
          'id',
          'allSeats',
          'freeSeats',
          'routeId',
          'dateOfDeparture'
        ],
        where: {},
        include: []
        // distinct: true
      };

      let query2 = {
        where: {
          dateOfDeparture: {
            [Op.gte]: new Date()
          }
        }
      };

      if (!parsedFilters.length) {
        query.limit = Number(size);
        query.offset = Number(start);
      } else {
        query.where[Op.and] = parsedFiltersWithFns
          ?.map((el) => {
            if (['discount', 'route'].includes(el?.id)) return null;
            const valueArr = transformStringToConstant(el?.value);

            if (valueArr.length === 1) {
              return queryHelper[el?.fn](
                transformBusFlightsTableKey(el?.id),
                valueArr?.[0]
              );
            } else {
              return {
                [Op.or]: [
                  ...valueArr.map((elem) => {
                    return queryHelper[el?.fn](
                      transformBusFlightsTableKey(el?.id),
                      elem
                    );
                  })
                ]
              };
            }
          })
          .filter(Boolean);

        parsedFiltersWithFns?.forEach((el) => {
          if (['discount', 'route'].includes(el?.id)) {
            switch (el?.id) {
              case 'discount': {
                query.where[Op.and].push(
                  queryHelper[el?.fn]('$discount.coef$', el?.value)
                );

                break;
              }
              case 'route': {
                query.where[Op.and].push(
                  sequelize.where(
                    sequelize.fn(
                      'REPLACE',
                      sequelize.col('route.routeattrs.name'),
                      ' ',
                      ''
                    ),
                    {
                      [queryHelper[el?.fn](null, null, true)]:
                        el?.value?.replace(/\s/g, '')
                    }
                  )
                );
                // query.where[Op.and].push(queryHelper[el?.fn]('$route.routeattrs.name$', el?.value));
                query.where[Op.and].push({
                  '$route.routeattrs.languageId$': { [Op.eq]: 1 }
                });
                break;
              }
              default: {
                break;
              }
            }
          }
        });
      }

      if (!parsedSorting.length) {
        query.order = [
          ['dateOfDeparture', 'ASC'],
          ['id', 'ASC']
        ];
      } else {
        query.order = parsedSorting
          ?.map((el) => {
            if (['discount', 'route'].includes(el?.id)) {
              switch (el?.id) {
                case 'route': {
                  return [
                    { model: Route },
                    { model: RouteAttributes, as: 'routeattrs' },
                    'name',
                    el?.desc ? 'DESC' : 'ASC'
                  ];
                }
                case 'discount': {
                  return [
                    { model: Discount },
                    'coef',
                    el?.desc ? 'DESC' : 'ASC'
                  ];
                }
                default: {
                  break;
                }
              }
            }
            return [
              transformBusFlightsTableKey(el?.id),
              el?.desc ? 'DESC' : 'ASC'
            ];
          })
          .filter(Boolean);
      }

      routeQuery.include.push(routeAttributesQuery);
      query.include.push(routeQuery);
      query.include.push(discountQuery);

      const { count, rows } = await BusFlight.findAndCountAll(query);
      const countAvailableFlights = await BusFlight.count(query2);
      const startPage = Math.floor((count - countAvailableFlights) / size);

      busFlights = rows?.map((bf) => bf?.toJSON());
      const dbData = busFlights.map((el) => ({
        busFlightId: String(el?.id),
        allSeats: el?.allSeats,
        freeSeats: el?.freeSeats,
        routeId: el?.route?.id ? String(el?.route?.id) : '',
        route: el?.route?.routeattrs?.[0]?.name,
        dateOfDeparture: el?.dateOfDeparture,
        discount: hasActualDiscount(el)
          ? Math.round(el.discount.coef * 100)
          : 'Без знижки'
      }));

      return res.json({
        status: 'ok',
        data: !parsedFilters.length
          ? dbData
          : (dbData?.slice(parseInt(start), parseInt(start) + parseInt(size)) ??
            []),
        meta: {
          totalRowCount: count || 0,
          startPage: startPage || 0,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/bus-flights/available-dates:
 *   get:
 *     summary: Available departure dates for a city pair (admin ticket form)
 *     description: >
 *       Returns the dates that have at least one flight with free seats for the
 *       given origin/destination and direction. Mirrors the public
 *       `/api/bus-flights/available-dates` contract; used to pre-populate the
 *       departure ("Пункт відправлення") and return ("Пункт повернення") date
 *       pickers in the admin ticket form (call once per column with the
 *       matching direction).
 *     tags: [Admin / Bus Flights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: originId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: destinationId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Only return dates on or after this date (defaults to today)
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [forwards, backwards], default: forwards }
 *         description: "`forwards` = origin→destination (departure), `backwards` = return leg"
 *     responses:
 *       200:
 *         description: Array of available dates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: array
 *                   items: { type: string, format: date }
 *                   example: ["2026-06-19", "2026-06-26"]
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/available-dates',
  [
    query('originId').isInt(),
    query('destinationId').isInt(),
    query('startDate')
      .optional()
      .isDate({ format: 'YYYY-MM-DD', strictMode: true }),
    query('direction')
      .optional()
      .isIn([constants.FORWARDS, constants.BACKWARDS]),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE, constants.MANAGER_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }

      const {
        originId,
        destinationId,
        startDate = null,
        direction = constants.FORWARDS
      } = req.query;

      const data = await getAvailableDates({
        originId,
        destinationId,
        startDate,
        direction
      });

      return res.json({
        status: 'ok',
        data
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/bus-flights/{id}:
 *   get:
 *     summary: Get a single bus flight by ID
 *     tags: [Admin / Bus Flights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Bus-flight detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   $ref: '#/components/schemas/BusFlightDetail'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalRowCount: { type: integer, example: 1 }
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  [
    param('id').isInt(),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE, constants.MANAGER_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }

      const { id } = req.params;
      let busFlight;

      let query = {
        attributes: [
          'id',
          'allSeats',
          'freeSeats',
          'routeId',
          'dateOfDeparture'
        ],
        where: {
          id
        },
        include: [
          {
            model: Route,
            attributes: ['id', 'countryId'],
            include: [
              {
                model: RouteAttributes,
                as: 'routeattrs',
                attributes: ['name'],
                where: {
                  languageId: {
                    [Op.eq]: 1
                  }
                }
              },
              {
                model: County,
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
          },
          {
            model: Discount,
            attributes: ['id', 'coef', 'busflightId', 'group']
          }
        ]
      };

      busFlight = await BusFlight.findOne(query);

      if (!busFlight) {
        throw AdminAPIError.NotFoundError(`Рейс з id ${id} не знайдено`);
      }

      busFlight = busFlight?.toJSON();

      return res.json({
        status: 'ok',
        data: {
          busFlightId: String(busFlight?.id),
          allSeats: busFlight?.allSeats,
          freeSeats: busFlight?.freeSeats,
          dateOfDeparture: busFlight?.dateOfDeparture,
          discount: hasActualDiscount(busFlight)
            ? Math.round(busFlight.discount.coef * 100)
            : 0,
          route: {
            id: busFlight?.route?.id ? String(busFlight?.route?.id) : '',
            label: busFlight?.route?.routeattrs?.[0]?.name,
            groupBy: busFlight?.route?.country?.countryattrs?.[0]?.name
          }
        },
        meta: {
          totalRowCount: 1
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/bus-flights:
 *   post:
 *     summary: Create a new bus flight
 *     tags: [Admin / Bus Flights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [allSeats, freeSeats, routeId, dateOfDeparture, discount]
 *             properties:
 *               allSeats:
 *                 type: integer
 *                 example: 50
 *               freeSeats:
 *                 type: integer
 *                 example: 50
 *               routeId:
 *                 type: integer
 *                 example: 3
 *               dateOfDeparture:
 *                 type: string
 *                 format: date
 *                 example: "2026-07-10"
 *               discount:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 0
 *                 description: Discount percentage (0 = no discount)
 *     responses:
 *       200:
 *         description: Created bus-flight record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('allSeats').isInt({ min: 0 }),
    body('freeSeats')
      .isInt({ min: 0 })
      .custom((value, { req }) => Number(value) <= Number(req.body.allSeats))
      .withMessage('freeSeats cannot exceed allSeats'),
    body('routeId').isInt(),
    body('dateOfDeparture').isDate({
      format: 'YYYY-MM-DD',
      strictMode: true
    }),
    body('discount').isInt({ min: 0, max: 100 }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { allSeats, freeSeats, routeId, dateOfDeparture, discount } =
        req.body;

      const queryObj = {
        allSeats: allSeats,
        freeSeats: freeSeats,
        routeId: routeId,
        dateOfDeparture: dateOfDeparture
      };

      const queryOpts = {};

      if (discount > 0) {
        queryObj.discount = {};
        queryObj.discount.coef = (discount / 100).toFixed(2);
        queryObj.discount.group = constants.BUS_FLIGHT;
        queryOpts.include = [{ association: BusFlight.Discount }];
      }

      let busFlight = await BusFlight.create(queryObj, queryOpts);

      return res.json({
        status: 'ok',
        data: busFlight?.toJSON()
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/bus-flights/{id}:
 *   put:
 *     summary: Update a bus flight
 *     tags: [Admin / Bus Flights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [allSeats, freeSeats, routeId, dateOfDeparture, discount]
 *             properties:
 *               allSeats: { type: integer }
 *               freeSeats: { type: integer }
 *               routeId: { type: integer }
 *               dateOfDeparture: { type: string, format: date }
 *               discount: { type: integer, minimum: 0, maximum: 100 }
 *     responses:
 *       200:
 *         description: Updated bus-flight record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data: { type: object }
 *       404:
 *         description: Not found
 */
router.put(
  '/:id',
  [
    param('id').isInt(),
    body('allSeats').isInt({ min: 0 }),
    body('freeSeats')
      .isInt({ min: 0 })
      .custom((value, { req }) => Number(value) <= Number(req.body.allSeats))
      .withMessage('freeSeats cannot exceed allSeats'),
    body('routeId').isInt(),
    body('dateOfDeparture').isDate({
      format: 'YYYY-MM-DD',
      strictMode: true
    }),
    body('discount').isInt({ min: 0, max: 100 }),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }
      const { allSeats, freeSeats, routeId, dateOfDeparture, discount } =
        req.body;

      const { id } = req.params;
      let busFlight;
      let query = {
        attributes: [
          'id',
          'allSeats',
          'freeSeats',
          'routeId',
          'dateOfDeparture'
        ],
        where: {
          id
        },
        include: [
          {
            model: Discount,
            attributes: ['id', 'coef', 'busflightId', 'group']
          }
        ]
      };
      busFlight = await BusFlight.findOne(query);

      if (!busFlight) {
        throw AdminAPIError.NotFoundError(`Рейс з id ${id} не знайдено`);
      }

      const queryObj = {
        allSeats: allSeats,
        freeSeats: freeSeats,
        routeId: routeId,
        dateOfDeparture: dateOfDeparture
      };

      const queryOpts = {
        where: {
          id
        },
        returning: true,
        plain: true
      };

      await BusFlight.update(queryObj, queryOpts);

      if (!busFlight?.discount) {
        // Only create a discount row when there is an actual discount, matching
        // the create handler — a 0% discount means "no discount", not a row.
        if (discount > 0) {
          await Discount.create({
            coef: (discount / 100).toFixed(2),
            group: constants.BUS_FLIGHT,
            busFlightId: id
          });
        }
      } else if (discount > 0) {
        const currentCoef = busFlight?.discount?.coef
          ? Number(busFlight.discount.coef)
          : 0;
        const newCoef = Number((discount / 100).toFixed(2));

        if (currentCoef !== newCoef) {
          await Discount.update(
            { coef: (discount / 100).toFixed(2) },
            { where: { busFlightId: id }, returning: true, plain: true }
          );
        }
      } else {
        // Discount dropped to 0 — remove the existing row so it does not linger
        // as a zero-coef discount.
        await Discount.destroy({ where: { busFlightId: id } });
      }

      await busFlight.reload();
      return res.json({
        status: 'ok',
        data: busFlight?.toJSON()
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/bus-flights/{id}:
 *   delete:
 *     summary: Delete a bus flight
 *     description: Also deletes the associated discount row (if any).
 *     tags: [Admin / Bus Flights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted bus-flight record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data: { type: object }
 *       404:
 *         description: Not found
 */
router.delete(
  '/:id',
  [
    param('id').isInt(),
    checkUserAuth,
    checkUserBlocked,
    checkUserActivation,
    checkUserPermissions(constants.ADMIN_ROLE)
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw AdminAPIError.ValidationError(
          'Помилка при валідації',
          errors.array()
        );
      }

      const { id } = req.params;
      let busFlight;
      let query = {
        attributes: [
          'id',
          'allSeats',
          'freeSeats',
          'routeId',
          'dateOfDeparture'
        ],
        where: {
          id
        },
        include: [
          {
            model: Discount,
            attributes: ['id', 'coef', 'busflightId', 'group']
          }
        ]
      };
      busFlight = await BusFlight.findOne(query);

      if (!busFlight) {
        throw AdminAPIError.NotFoundError(`Рейс з id ${id} не знайдено`);
      }

      if (busFlight?.discount) {
        const discountQueryOpts = {
          where: {
            busFlightId: id
          },
          returning: true,
          plain: true
        };

        await Discount.destroy(discountQueryOpts);
      }

      const queryOpts = {
        where: {
          id
        },
        returning: true,
        plain: true
      };

      await BusFlight.destroy(queryOpts);

      return res.json({
        status: 'ok',
        data: busFlight?.toJSON()
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
