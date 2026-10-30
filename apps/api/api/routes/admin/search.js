/** @format */

const { Router } = require('express');
const { Op } = require('sequelize');
const { validationResult, query } = require('express-validator');
const AdminAPIError = require('@exeptions/admin/api-error');
const constants = require('@helpers/constants.js');
const {
  agent: Agent,
  agentattributes: AgentAttributes,
  busflight: BusFlight,
  city: City,
  cityattributes: CityAttributes,
  country: Country,
  countryattributes: CountryAttributes,
  discount: Discount,
  // discountattributes: DiscountAttributes,
  passenger: Passenger,
  // passengerticket: PassengerTicket,
  route: Route,
  routeattributes: RouteAttributes,
  ticket: Ticket
} = require('../../../database/models/index');
const {
  checkUserPermissions,
  checkUserAuth,
  checkUserBlocked,
  checkUserActivation
} = require('@middlewares/admin/authMiddlewares');
const {
  getConstantTranslation,
  isValidDate,
  transformDateString,
  // transformDate,
  transformTicketBusFlightToString,
  transformTimestampToDate
} = require('@helpers');
const {
  supportsDirection,
  filterFlatFlightsByCustomRouteGroup
} = require('@services/busFlightService');
const router = Router();

/**
 * @swagger
 * /api/admin/search/agents:
 *   get:
 *     summary: Autocomplete search for agents
 *     description: Returns up to 8 agents whose name contains the search string.
 *     tags: [Admin / Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: s
 *         required: true
 *         schema: { type: string, example: "Norml" }
 *         description: Search string (substring match on agent name)
 *     responses:
 *       200:
 *         description: Agent suggestions
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
 *                       agentId: { type: string }
 *                       name: { type: string }
 *                       label: { type: string, description: "ID - Name" }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalRowCount: { type: integer }
 */
router.get(
  '/agents',
  [
    query('s').isString(),
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

      const { s = '' } = req?.query ?? {};

      const attrWhere = { languageId: { [Op.eq]: 1 } };
      if (s) {
        attrWhere.name = { [Op.substring]: s };
      }

      const { rows } = await Agent.findAndCountAll({
        attributes: ['id'],
        include: [
          {
            model: AgentAttributes,
            as: 'agentattrs',
            attributes: ['name'],
            where: attrWhere
          }
        ],
        order: [['id', 'ASC']],
        limit: 8
      });

      const agents = rows.map((a) => a.toJSON());

      return res.json({
        status: 'ok',
        data: agents.map((el) => ({
          agentId: String(el?.id),
          name: el?.agentattrs?.[0]?.name,
          label: `${String(el?.id)} - ${el?.agentattrs?.[0]?.name}`
        })),
        meta: {
          totalRowCount: agents.length
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/search/bus-flights:
 *   get:
 *     summary: Autocomplete search for bus flights by date (and optionally city pair)
 *     description: >
 *       Returns bus flights whose `dateOfDeparture` matches the date extracted from
 *       the search string. When `originId` and `destinationId` are both supplied, the
 *       result is further restricted to flights whose route actually connects that
 *       city pair in the requested `direction` (the origin must be an onboarding stop
 *       and the destination an outboarding stop), so an admin only sees flights that
 *       can serve the selected route. Without the city params it behaves as before
 *       (date-only, capped at 4 results).
 *     tags: [Admin / Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: s
 *         required: true
 *         schema: { type: string, example: "19.06.2026" }
 *         description: Search string containing a date (various formats accepted)
 *       - in: query
 *         name: originId
 *         schema: { type: integer }
 *         description: Origin city ID. When set together with destinationId, flights are filtered to this city pair.
 *       - in: query
 *         name: destinationId
 *         schema: { type: integer }
 *         description: Destination city ID. When set together with originId, flights are filtered to this city pair.
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [forwards, backwards], default: forwards }
 *         description: >
 *           Travel direction relative to the city pair. `forwards` = origin → destination
 *           (departure flight); `backwards` = destination → origin (return flight).
 *     responses:
 *       200:
 *         description: Bus-flight suggestions
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
 *                       busFlightId: { type: string }
 *                       routeId: { type: string }
 *                       name: { type: string, example: "Київ — Штутгарт" }
 *                       dateOfDeparture: { type: string, format: date }
 *                       freeSeats: { type: integer }
 *                       discount: { type: integer }
 *                       label: { type: string }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalRowCount: { type: integer }
 */
router.get(
  '/bus-flights',
  [
    query('s').isString(),
    query('originId').isInt().optional({ values: 'null' }),
    query('destinationId').isInt().optional({ values: 'null' }),
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

      let busFlights = [];

      const {
        s = '',
        originId,
        destinationId,
        direction = constants.FORWARDS
      } = req?.query ?? {};

      const searchDate = transformDateString(s);
      // Filter by city pair only when both endpoints are supplied; otherwise the
      // route keeps its legacy date-only behaviour.
      const filterByCityPair = !!originId && !!destinationId;

      let query = {
        attributes: [
          'id',
          'allSeats',
          'freeSeats',
          'routeId',
          'dateOfDeparture'
        ],
        where: {
          dateOfDeparture: {
            [Op.eq]: isValidDate(searchDate) ? searchDate : null
          }
        },
        include: [
          {
            model: Route,
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
              }
            ]
          },
          {
            model: Discount,
            attributes: ['id', 'coef']
          }
        ],
        order: [
          ['dateOfDeparture', 'ASC'],
          ['id', 'ASC']
        ],
        // When filtering by city pair the cap is applied AFTER the route-match
        // filter (below); a pre-filter LIMIT would drop valid matches.
        ...(filterByCityPair ? {} : { limit: 4 })
      };

      const { rows } = await BusFlight.findAndCountAll(query);
      busFlights = rows?.map((bf) => bf?.toJSON());

      if (filterByCityPair) {
        // Keep only flights whose route actually connects the city pair in the
        // requested direction (forwards: origin→destination; backwards: the
        // return leg destination→origin).
        busFlights = busFlights.filter((bf) =>
          direction === constants.BACKWARDS
            ? supportsDirection(bf, destinationId, originId)
            : supportsDirection(bf, originId, destinationId)
        );

        // Drop the non-canonical route group when a shared city (e.g. Дрезден /
        // 12, which sits on both the Düsseldorf and Munich lines) is selected,
        // so the same pair isn't served by an ambiguous duplicate line.
        busFlights = filterFlatFlightsByCustomRouteGroup(
          busFlights,
          originId,
          destinationId
        ).slice(0, 4);
      }

      return res.json({
        status: 'ok',
        data: busFlights.map((el) => ({
          busFlightId: String(el?.id),
          routeId: String(el?.routeId),
          name: el?.route?.routeattrs?.[0]?.name,
          dateOfDeparture: el?.dateOfDeparture,
          freeSeats: el?.freeSeats,
          discount: el?.discount ? Math.round(el.discount.coef * 100) : 0,
          label: transformTicketBusFlightToString({
            name: el?.route?.routeattrs?.[0]?.name,
            dateOfDeparture: el?.dateOfDeparture,
            freeSeats: el?.freeSeats,
            discount: el?.discount ? Math.round(el.discount.coef * 100) : 0
          })
        })),
        meta: {
          totalRowCount: busFlights?.length || 0
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/search/passengers:
 *   get:
 *     summary: Autocomplete search for passengers by phone number
 *     description: Returns up to 8 passengers whose phone contains the numeric portion of the search string.
 *     tags: [Admin / Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: s
 *         required: true
 *         schema: { type: string, example: "+380671234567" }
 *         description: Search string (digits extracted and matched against phone last 7 digits)
 *     responses:
 *       200:
 *         description: Passenger suggestions
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
 *                       passengerId: { type: string }
 *                       name: { type: string }
 *                       lastName: { type: string }
 *                       phone: { type: string }
 *                       dateOfBirth: { type: string, format: date }
 *                       email: { type: string }
 *                       label: { type: string, description: "ID - LastName Name (phone)" }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalRowCount: { type: integer }
 */
router.get(
  '/passengers',
  [
    query('s').isString(),
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

      let passengers = [];

      const { s = '' } = req?.query ?? {};

      // let symbols = s.replace(/[^a-zA-Zа-яА-Я\s]/g, "");
      let numbers = s.replace(/[^\d+]/g, '');

      let query = {
        attributes: [
          'id',
          'name',
          'lastName',
          'phone',
          'additionalPhone',
          'dateOfBirth',
          'email',
          'type'
        ],
        where: {},
        order: [
          ['lastName', 'ASC'],
          ['id', 'ASC']
        ],
        limit: 8
      };

      // if(symbols) {
      //     query.where[Op.or] = [
      //     ...symbols.split(/\s/).map(el => (!!el ? {name: {[Op.substring]: el}} : null)),
      //     ...symbols.split(/\s/).map(el => (!!el ? {lastName: {[Op.substring]: el}} : null))];
      // }

      if (numbers) {
        if (!query.where[Op.or]) {
          query.where[Op.or] = [
            {
              phone: {
                [Op.substring]: numbers?.substr(-7)
              }
            }
          ];
        } else {
          query.where[Op.or].push({
            phone: {
              [Op.substring]: numbers?.substr(-7)
            }
          });
        }
      }

      const { count, rows } = await Passenger.findAndCountAll(query);
      passengers = rows?.map((pass) => pass?.toJSON());

      // if(symbols) {
      //     passengers = passengers?.filter(pass => {
      //         return (pass.name + pass.lastName).toLowerCase().includes(symbols.split(/\s/).join("").toLowerCase()) ||
      //         (pass.lastName + pass.name).toLowerCase().includes(symbols.split(/\s/).join("").toLowerCase());
      //     });
      // }

      return res.json({
        status: 'ok',
        data: passengers.map((el) => ({
          passengerId: String(el?.id),
          name: String(el?.name),
          lastName: el?.lastName,
          phone: el?.phone,
          passengerType: el?.type || 'adult',
          additionalPhone: el?.additionalPhone,
          dateOfBirth: el?.dateOfBirth,
          email: el?.email,
          passengerDiscount: { id: '0', percentage: 0, name: 'Без знижки' },
          discountCardNumber: null,
          label: `${String(el?.id)} - ${el?.lastName} ${el?.name} (${el?.phone})`
        })),
        meta: {
          totalRowCount: passengers?.length || 0
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/search/tickets:
 *   get:
 *     summary: Autocomplete search for tickets by ID, ticket number or departure date
 *     description: Returns up to 8 matching tickets. Excludes ticket IDs passed in `ticketsIds`.
 *     tags: [Admin / Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: s
 *         required: true
 *         schema: { type: string }
 *         description: Search string (ticket/passenger ID, date, or ticket number)
 *       - in: query
 *         name: ticketsIds
 *         required: true
 *         schema: { type: string, example: "[]" }
 *         description: JSON array of ticket IDs to exclude from results
 *     responses:
 *       200:
 *         description: Ticket suggestions
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
 *                       ticketId: { type: string }
 *                       origin: { type: object }
 *                       destination: { type: object }
 *                       busFlightFrom: { type: object }
 *                       price: { type: number }
 *                       currency: { type: string }
 *                       label: { type: string }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalRowCount: { type: integer }
 */
router.get(
  '/tickets',
  [
    query('s').isString(),
    query('ticketsIds').isString(),
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

      let tickets = [];

      const { s = '', ticketsIds = '[]' } = req?.query ?? {};

      // const regex = /\d+-[А-Яа-яЁёҐґЄєІіЇї]+-[А-Яа-яЁёҐґЄєІіЇї]+\(\d{2}-\d{2}-\d{4}\|\d{2}-\d{2}-\d{4}\)/;
      const parsetTicketsIds = JSON.parse(ticketsIds);
      let searchDateStart = null;
      let searchDateEnd = null;
      let numbers = null;
      // let match = regex.exec(s.replace(/\s/g, ""));
      // if(match) {

      // }
      numbers = s.replace(/[^\d+]/g, '');
      searchDateStart = transformDateString(s);

      let query = {
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'dateOfCreature',
          'busFlightFromId',
          'busFlightToId',
          'price',
          'currencyAbbr',
          'type',
          'status',
          'signature',
          'dateOfFirstUsage',
          'hasDiscount',
          'discountPercentage',
          'originId',
          'destinationId',
          'PDFFileName',
          'prevPDFFileName',
          'createdAt'
        ],
        where: {},
        include: [
          {
            model: City,
            as: 'originCity',
            include: [
              {
                model: CityAttributes,
                as: 'cityattrs',
                attributes: ['name'],
                where: {
                  languageId: {
                    [Op.eq]: 1
                  }
                }
              },
              {
                model: Country,
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
            model: City,
            as: 'destinationCity',
            include: [
              {
                model: CityAttributes,
                as: 'cityattrs',
                attributes: ['name'],
                where: {
                  languageId: {
                    [Op.eq]: 1
                  }
                }
              },
              {
                model: Country,
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
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture', 'freeSeats'],
            as: 'busFlightFrom',
            where: {
              freeSeats: {
                [Op.gte]: 1
              }
            },
            include: [
              {
                model: Route,
                attributes: ['id'],
                include: [
                  {
                    model: RouteAttributes,
                    required: false,
                    as: 'routeattrs',
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
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture', 'freeSeats'],
            as: 'busFlightTo',
            where: {
              freeSeats: {
                [Op.gte]: 1
              }
            },
            include: [
              {
                model: Route,
                attributes: ['id'],
                include: [
                  {
                    model: RouteAttributes,
                    required: false,
                    as: 'routeattrs',
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
          }
        ],
        order: [
          ['id', 'ASC'],
          ['dateOfDeparture', 'ASC']
        ],
        limit: 8
      };

      if (searchDateStart instanceof Date) {
        query.where = {
          [Op.or]: [
            {
              [Op.and]: [
                { id: { [Op.substring]: numbers } },
                { id: { [Op.notIn]: parsetTicketsIds || [] } }
              ]
            },
            {
              [Op.and]: [
                { ticketNumber: { [Op.substring]: numbers } },
                { id: { [Op.notIn]: parsetTicketsIds || [] } }
              ]
            },
            {
              [Op.or]: [
                {
                  dateOfDeparture: {
                    [Op.eq]: isValidDate(searchDateStart)
                      ? searchDateStart
                      : null
                  }
                },
                {
                  dateOfReturn: {
                    [Op.eq]:
                      searchDateEnd instanceof Date &&
                      isValidDate(searchDateEnd)
                        ? searchDateEnd
                        : isValidDate(searchDateStart)
                          ? searchDateStart
                          : null
                  }
                }
              ]
            }
          ]
        };
      } else {
        query.where = {
          [Op.or]: [
            {
              [Op.and]: [
                { id: { [Op.substring]: numbers } },
                { id: { [Op.notIn]: parsetTicketsIds || [] } }
              ]
            },
            {
              [Op.and]: [
                { ticketNumber: { [Op.substring]: numbers } },
                { id: { [Op.notIn]: parsetTicketsIds || [] } }
              ]
            }
          ]
        };
      }

      const { count, rows } = await Ticket.findAndCountAll(query);
      tickets = rows?.map((tick) => tick?.toJSON());

      return res.json({
        status: 'ok',
        data: tickets.map((el) => ({
          ticketId: String(el?.id),
          type: getConstantTranslation(el?.type),
          dateOfCreature: el?.dateOfCreature,
          dateOfDeparture: el?.dateOfDeparture,
          dateOfReturn: el?.dateOfReturn || '-',
          origin: {
            id: el?.originCity?.id ? String(el?.originCity?.id) : '',
            name: el?.originCity?.cityattrs?.[0]?.name,
            countryId: el?.originCity?.country?.id
              ? String(el?.originCity?.country?.id)
              : ''
          },
          destination: {
            id: el?.destinationCity?.id ? String(el?.destinationCity?.id) : '',
            name: el?.destinationCity?.cityattrs?.[0]?.name,
            countryId: el?.destinationCity?.country?.id
              ? String(el?.destinationCity?.country?.id)
              : ''
          },
          busFlightFrom: {
            id: el?.busFlightFrom?.id ? String(el?.busFlightFrom?.id) : '',
            routeId: el?.busFlightFrom?.routeId
              ? String(el?.busFlightFrom?.routeId)
              : '',
            freeSeats: Number(el?.busFlightFrom?.freeSeats),
            name: el?.busFlightFrom?.route?.routeattrs?.[0]?.name,
            discount: el?.busFlightFrom?.discount
              ? Math.round(el.busFlightFrom.discount.coef * 100)
              : 0,
            dateOfDeparture: el?.busFlightFrom?.dateOfDeparture
          },
          busFlightTo: el?.busFlightTo?.id
            ? {
                id: el?.busFlightTo?.id ? String(el?.busFlightTo?.id) : '',
                routeId: el?.busFlightTo?.routeId
                  ? String(el?.busFlightTo?.routeId)
                  : '',
                freeSeats: Number(el?.busFlightTo?.freeSeats),
                name: el?.busFlightTo?.route?.routeattrs?.[0]?.name,
                discount: el?.busFlightTo?.discount
                  ? Math.round(el.busFlightTo.discount.coef * 100)
                  : 0,
                dateOfDeparture: el?.busFlightTo?.dateOfDeparture
              }
            : '-',
          price: el?.price,
          currency: el?.currencyAbbr,
          status: getConstantTranslation(el?.status),
          dateOfFirstUsage: el?.dateOfFirstUsage,
          discount: el?.hasDiscount ? el?.discountPercentage : 'Без знижки',
          pdfName: el?.PDFFileName + '.pdf',
          isPDFExists: !!el?.PDFFileName,
          passengerDiscount: { id: '0', percentage: 0, name: 'Без знижки' },
          discountCardNumber: null,
          label: `${String(el?.id)} - ${el?.originCity?.cityattrs?.[0]?.name}-${el?.destinationCity?.cityattrs?.[0]?.name} (${transformTimestampToDate(Date.parse(el?.dateOfDeparture), '-')}${el?.dateOfReturn ? '|' + transformTimestampToDate(Date.parse(el?.dateOfReturn), '-') : ''})`
        })),
        meta: {
          totalRowCount: tickets?.length || 0
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
