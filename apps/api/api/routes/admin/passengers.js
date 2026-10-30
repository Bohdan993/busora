/** @format */

const { Router } = require('express');
const sequelize = require('@database/models/index').sequelize;
const { Op } = require('sequelize');
const { body, validationResult, param, query } = require('express-validator');
const {
  updateTicketPDFFile
  // prepareTicketPDFUpdate,
} = require('@services/ticketService');
const AdminAPIError = require('@exeptions/admin/api-error');
const constants = require('@helpers/constants.js');
const queryHelper = require('@helpers/queries');
const {
  route: Route,
  busflight: BusFlight,
  routeattributes: RouteAttributes,
  discount: Discount,
  discountattributes: DiscountAttributes,
  country: Country,
  countryattributes: CountryAttributes,
  ticket: Ticket,
  passengerticket: PassengerTicket,
  passenger: Passenger,
  city: City,
  cityattributes: CityAttributes,
  ticketmeta: TicketMeta,
  ticketmetaattributes: TicketMetaAttributes
} = require('@database/models/index');
const {
  checkUserPermissions,
  checkUserAuth,
  checkUserBlocked,
  checkUserActivation
} = require('@middlewares/admin/authMiddlewares');
const {
  mapStringsToConstants,
  hashCode,
  transformStringToConstant
} = require('@helpers');
const {
  transformPassenger,
  transformPassengersTableKey,
  createPassenger
} = require('@services/passengerService');
const router = Router();

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
      let passengers = [];
      const {
        start = 0,
        size = 10,
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

      let originCityCountryQuery = {
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
            },
            required: false
          }
        ]
      };

      let originCityAttributesQuery = {
        model: CityAttributes,
        // retuired: true,
        as: 'cityattrs',
        attributes: ['name'],
        where: {
          languageId: {
            [Op.eq]: 1
          }
        },
        required: false
      };

      let originCityQuery = {
        model: City,
        attributes: ['id', 'countryId'],
        as: 'originCity',
        include: []
      };

      let destinationCityCountryQuery = {
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
            },
            required: false
          }
        ]
      };

      let destinationCityAttributesQuery = {
        model: CityAttributes,
        as: 'cityattrs',
        attributes: ['name'],
        where: {
          languageId: {
            [Op.eq]: 1
          }
        },
        required: false
      };

      let destinationCityQuery = {
        model: City,
        as: 'destinationCity',
        attributes: ['id', 'countryId'],
        include: []
      };

      let busFlightFromRouteAttributesQuery = {
        model: RouteAttributes,
        required: false,
        as: 'routeattrs',
        attributes: ['name'],
        where: {
          languageId: {
            [Op.eq]: 1
          }
        }
      };

      let busFlightFromRouteQuery = {
        model: Route,
        attributes: ['id'],
        include: []
      };

      let busFlightFromQuery = {
        model: BusFlight,
        attributes: ['id', 'routeId', 'dateOfDeparture', 'freeSeats'],
        as: 'busFlightFrom',
        include: []
      };

      let busFlightToRouteAttributesQuery = {
        model: RouteAttributes,
        required: false,
        as: 'routeattrs',
        attributes: ['name'],
        where: {
          languageId: {
            [Op.eq]: 1
          }
        }
      };

      let busFlightToRouteQuery = {
        model: Route,
        attributes: ['id'],
        include: []
      };

      let busFlightToQuery = {
        model: BusFlight,
        attributes: ['id', 'routeId', 'dateOfDeparture', 'freeSeats'],
        as: 'busFlightTo',
        include: []
      };

      let discountQuery = {
        model: Discount,
        attributes: ['id', 'coef'],
        include: [
          {
            model: DiscountAttributes,
            required: false,
            as: 'discountattrs',
            attributes: ['name'],
            where: {
              languageId: {
                [Op.eq]: 1
              }
            }
          }
        ]
      };
      let ticketQuery = {
        model: Ticket,
        // required: true,
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'dateOfCreature',
          'price',
          'currencyAbbr',
          'typeId',
          'statusId',
          'signature',
          'dateOfFirstUsage',
          'hasDiscount',
          'discountPercentage',
          'PDFFileName',
          'prevPDFFileName',
          'createdAt',
          'updatedAt'
        ],
        // through: {
        //     attributes: ['id', 'passengerDiscountId', 'discountCardNumber', 'ticketId', 'passengerId']
        // },
        include: []
      };

      let passengerTicketQuery = {
        model: PassengerTicket,
        attributes: [
          'id',
          'ticketId',
          'passengerId',
          'passengerDiscountId',
          'discountCardNumber'
        ],
        include: []
      };

      let query = {
        // subQuery: false,
        attributes: [
          'id',
          'name',
          'lastName',
          'phone',
          'additionalPhone',
          'dateOfBirth',
          'email',
          'createdAt',
          'updatedAt'
        ],
        where: {},
        include: [],
        distinct: true
        // duplicating: false,
        // seperate: true
      };

      originCityQuery.include.push(originCityAttributesQuery);
      originCityQuery.include.push(originCityCountryQuery);

      destinationCityQuery.include.push(destinationCityAttributesQuery);
      destinationCityQuery.include.push(destinationCityCountryQuery);

      busFlightFromRouteQuery.include.push(busFlightFromRouteAttributesQuery);
      busFlightFromQuery.include.push(busFlightFromRouteQuery);
      busFlightToRouteQuery.include.push(busFlightToRouteAttributesQuery);
      busFlightToQuery.include.push(busFlightToRouteQuery);

      // Add TicketMeta joins for localized type and status names
      ticketQuery.include.push({
        model: TicketMeta,
        as: 'typeMeta',
        attributes: ['id'],
        include: [
          {
            model: TicketMetaAttributes,
            as: 'ticketmetaattrs',
            attributes: ['name'],
            where: {
              languageId: { [Op.eq]: 1 }
            },
            required: false
          }
        ],
        where: {
          id: sequelize.col('ticket.typeId')
        },
        required: false
      });

      ticketQuery.include.push({
        model: TicketMeta,
        as: 'statusMeta',
        attributes: ['id'],
        include: [
          {
            model: TicketMetaAttributes,
            as: 'ticketmetaattrs',
            attributes: ['name'],
            where: {
              languageId: { [Op.eq]: 1 }
            },
            required: false
          }
        ],
        where: {
          id: sequelize.col('ticket.statusId')
        },
        required: false
      });

      ticketQuery.include.push(originCityQuery);
      ticketQuery.include.push(destinationCityQuery);
      ticketQuery.include.push(busFlightFromQuery);
      ticketQuery.include.push(busFlightToQuery);

      passengerTicketQuery.include.push(ticketQuery);
      passengerTicketQuery.include.push(discountQuery);

      query.include.push(passengerTicketQuery);

      if (!parsedFilters.length) {
        query.limit = Number(size);
        query.offset = Number(start);
      } else {
        query.where[Op.and] = parsedFiltersWithFns
          ?.map((el) => {
            if (['passengerType'].includes(el?.id)) return null;
            const valueArr = transformStringToConstant(el?.value);

            if (valueArr.length === 1) {
              return queryHelper[el?.fn](
                transformPassengersTableKey(el?.id),
                valueArr?.[0]
              );
            } else {
              return {
                [Op.or]: [
                  ...valueArr.map((elem) => {
                    return queryHelper[el?.fn](
                      transformPassengersTableKey(el?.id),
                      elem
                    );
                  })
                ]
              };
            }
          })
          .filter(Boolean);
      }

      if (!parsedSorting.length) {
        query.order = [
          ['id', 'ASC'],
          ['lastName', 'ASC']
        ];
      } else {
        query.order = parsedSorting
          ?.map((el) => {
            if (['passengerType'].includes(el?.id)) return null;
            return [
              transformPassengersTableKey(el?.id),
              el?.desc ? 'DESC' : 'ASC'
            ];
          })
          .filter(Boolean);
      }

      const { count, rows } = await Passenger.findAndCountAll(query);
      passengers = rows?.map((passenger) => passenger?.toJSON());
      const dbData = await Promise.all(passengers.map(transformPassenger));

      return res.json({
        status: 'ok',
        data: !parsedFilters.length
          ? dbData
          : (dbData?.slice(parseInt(start), parseInt(start) + parseInt(size)) ??
            []),
        meta: {
          totalRowCount: count || 0,
          startPage: 0,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/',
  [
    body('name').isString(),
    body('lastName').isString(),
    body('dateOfBirth').isDate({
      format: 'YYYY-MM-DD',
      strictMode: true
    }),
    body('phone').isString(),
    body('additionalPhone').isString().optional({ values: 'null' }),
    body('email').isString().optional({ values: 'null' }),
    body('tickets').isArray(),
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
      const {
        name,
        lastName,
        dateOfBirth,
        phone,
        additionalPhone,
        email,
        tickets
      } = req.body;

      const passenger = await createPassenger(
        {
          name,
          lastName,
          phone,
          dateOfBirth,
          additionalPhone,
          email
        },
        tickets
      );

      return res.json({
        status: 'ok',
        data: { passengerId: passenger?.id ? String(passenger.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/tickets',
  [
    body('passengerId').isString(),
    body('id').isString().optional({ values: 'null' }),
    body('data').isObject().optional({ values: 'null' }),
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
      const { passengerId, id, data } = req.body;

      let passenger;
      let query = {
        attributes: [
          'id',
          'name',
          'lastName',
          'phone',
          'additionalPhone',
          'dateOfBirth',
          'email'
        ],
        where: {
          id: passengerId
        },
        order: [
          ['id', 'ASC'],
          ['lastName', 'ASC']
        ]
      };
      passenger = await Passenger.findOne(query);

      if (!passenger) {
        throw AdminAPIError.NotFoundError(
          `Пасажира з id ${passengerId} не знайдено`
        );
      }

      let ticket;
      let ticketQuery = {
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'busFlightFromId',
          'busFlightToId',
          'price',
          'currencyAbbr',
          'typeId',
          'statusId',
          'signature',
          'dateOfFirstUsage',
          'hasDiscount',
          'discountPercentage',
          'originId',
          'destinationId',
          'PDFFileName',
          'prevPDFFileName'
        ],
        where: {
          id: id
        },
        include: [
          {
            model: PassengerTicket,
            attributes: ['id', 'ticketId', 'passengerId']
          },
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightFrom'
          },
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightTo'
          }
        ],
        order: [
          ['id', 'ASC'],
          ['dateOfDeparture', 'ASC']
        ]
      };

      ticket = await Ticket.findOne(ticketQuery);

      if (!ticket) {
        throw AdminAPIError.NotFoundError(`Квитка з id ${id} не знайдено`);
      }

      if (
        ticket?.passengertickets?.some(
          (el) => String(el.passangerId) === String(passengerId)
        )
      ) {
        throw AdminAPIError.BadRequestError('Помилка', [
          `У квитку з id ${id} уже присутній пасажир з id ${passengerId}`
        ]);
      }

      const passengerData = {
        passengerId: passenger?.id,
        ticketId: ticket?.id
      };

      if (parseInt(data?.passengerDiscount?.id)) {
        passengerData['passengerDiscountId'] = data.passengerDiscount.id;
      }

      if (data?.discountCardNumber) {
        passengerData['discountCardNumber'] = data.discountCardNumber;
      }

      await PassengerTicket.create(passengerData);

      await updateTicketPDFFile(ticket);
      await BusFlight.decrement(
        {
          freeSeats: 1
        },
        {
          where: {
            [Op.or]: [
              { id: ticket?.busFlightFrom?.id || null },
              { id: ticket?.busFlightTo?.id || null }
            ]
          }
        }
      );

      return res.json({
        status: 'ok',
        data: { passengerId: passenger?.id ? String(passenger.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  [
    param('id').isInt(),
    body('name').isString(),
    body('passengerType').isString(),
    body('lastName').isString(),
    body('dateOfBirth').isDate({
      format: 'YYYY-MM-DD',
      strictMode: true
    }),
    body('phone').isString().optional({ values: 'null' }),
    body('additionalPhone').isString().optional({ values: 'null' }),
    body('email').isString().optional({ values: 'null' }),
    body('ticketId').isInt().optional({ values: 'null' }),
    body('passengerDiscount').isObject().optional({ values: 'null' }),
    body('discountCardNumber').isString().optional({ values: 'null' }),
    // body("tickets")
    //     .isArray(),
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
      const {
        name,
        passengerType,
        lastName,
        dateOfBirth,
        phone,
        additionalPhone,
        email,
        ticketId,
        passengerDiscount,
        discountCardNumber
      } = req.body;

      const { id } = req.params;

      let passenger;
      let ticket;

      if (passengerType === 'adult') {
        const query = {
          attributes: [
            'id',
            'name',
            'lastName',
            'dateOfBirth',
            'phone',
            'additionalPhone',
            'email'
          ],
          where: {
            id
          },
          include: [
            {
              model: PassengerTicket,
              attributes: [
                'id',
                'passengerDiscountId',
                'discountCardNumber',
                'ticketId',
                'passengerId'
              ],
              include: [
                {
                  model: Ticket,
                  attributes: [
                    'id',
                    'dateOfDeparture',
                    'dateOfReturn',
                    'dateOfCreature',
                    'price',
                    'currencyAbbr',
                    'typeId',
                    'statusId',
                    'signature',
                    'dateOfFirstUsage',
                    'hasDiscount',
                    'discountPercentage',
                    'PDFFileName',
                    'prevPDFFileName',
                    'createdAt',
                    'updatedAt'
                  ]
                }
              ]
            }
          ],
          order: [
            ['id', 'ASC'],
            ['lastName', 'ASC']
          ]
        };
        passenger = await Passenger.findOne(query);

        if (!passenger) {
          throw AdminAPIError.NotFoundError(`Пасажира з id ${id} не знайдено`);
        }

        const queryObj = mapStringsToConstants({
          name: name,
          lastName: lastName,
          dateOfBirth: dateOfBirth,
          phone: phone,
          additionalPhone: additionalPhone,
          email: email
        });

        const queryOpts = {
          where: {
            id
          },
          returning: true
        };

        const currPassengerEssentialFields = {
          id: String(id),
          name: String(name),
          lastName: String(lastName),
          dateOfBirth: new Date(dateOfBirth).toString()
        };

        const prevPassengerEssentialFields = {
          id: String(passenger?.id),
          name: String(passenger?.name),
          lastName: String(passenger?.lastName),
          dateOfBirth: new Date(passenger?.dateOfBirth).toString()
        };

        if (ticketId) {
          const ticket = Ticket.findOne({ where: { id: ticketId } });

          if (!ticket) {
            throw AdminAPIError.BadRequestError('Помилка', [
              `Пасажира з id ${id} немає у квитку з id ${ticketId}`
            ]);
          }

          await PassengerTicket.update(
            {
              passengerDiscountId: passengerDiscount
                ? passengerDiscount?.id
                : null,
              discountCardNumber: discountCardNumber ? discountCardNumber : null
            },
            {
              where: {
                [Op.and]: [
                  { passengerId: passenger?.id },
                  { ticketId: ticketId }
                ]
              }
            }
          );

          await updateTicketPDFFile(ticket);
        }

        if (
          hashCode(JSON.stringify(currPassengerEssentialFields)) !==
          hashCode(JSON.stringify(prevPassengerEssentialFields))
        ) {
          const t = await sequelize.transaction();
          try {
            await Promise.all(
              passenger?.passengertickets?.map(async (el) => {
                await updateTicketPDFFile(el?.ticket, t);
                return el?.ticket?.id;
              })
            );
            await t.commit();
          } catch (err) {
            await t.rollback();
          }
        }

        await Passenger.update(queryObj, queryOpts);
      }

      if (passengerType === 'child') {
        await Passenger.update(
          {
            name,
            lastName,
            dateOfBirth: dateOfBirth || null
          },
          { where: { id, type: 'child' } }
        );

        if (ticketId) {
          const rawDiscountId = passengerDiscount?.id;
          await PassengerTicket.update(
            {
              passengerDiscountId:
                rawDiscountId && rawDiscountId !== '0' ? rawDiscountId : null,
              discountPercentage: passengerDiscount?.percentage || null
            },
            { where: { passengerId: id, ticketId } }
          );

          const ticket = await Ticket.findOne({
            attributes: ['id', 'PDFFileName', 'prevPDFFileName'],
            where: { id: ticketId }
          });
          if (ticket) await updateTicketPDFFile(ticket);
        }
      }

      return res.json({
        status: 'ok',
        data: { passengerId: passenger?.id ? String(passenger.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

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
      let passenger;
      const query = {
        attributes: [
          'id',
          'name',
          'lastName',
          'phone',
          'additionalPhone',
          'dateOfBirth',
          'email'
        ],
        where: {
          id
        },
        include: [
          {
            model: PassengerTicket,
            attributes: [
              'id',
              'passengerDiscountId',
              'discountCardNumber',
              'ticketId',
              'passengerId'
            ],
            include: [
              {
                model: Discount,
                attributes: ['id', 'coef'],
                include: [
                  {
                    model: DiscountAttributes,
                    required: false,
                    as: 'discountattrs',
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
                model: Ticket,
                attributes: [
                  'id',
                  'dateOfDeparture',
                  'dateOfReturn',
                  'busFlightFromId',
                  'busFlightToId',
                  'price',
                  'currencyAbbr',
                  'typeId',
                  'statusId',
                  'hasDiscount',
                  'discountPercentage',
                  'PDFFileName',
                  'prevPDFFileName',
                  'originId',
                  'destinationId'
                ],
                include: [
                  {
                    model: BusFlight,
                    attributes: ['id', 'routeId', 'dateOfDeparture'],
                    as: 'busFlightFrom'
                  },
                  {
                    model: BusFlight,
                    attributes: ['id', 'routeId', 'dateOfDeparture'],
                    as: 'busFlightTo'
                  }
                ]
              }
            ]
          }
        ],
        order: [
          ['id', 'ASC'],
          ['lastName', 'ASC']
        ]
      };
      passenger = await Passenger.findOne(query);

      if (!passenger) {
        throw AdminAPIError.NotFoundError(`Пасажира з id ${id} не знайдено`);
      }

      const queryOpts = {
        where: {
          id
        },
        returning: true,
        plain: true
      };

      const passengerTickets = passenger?.passengertickets?.map((el) => {
        return el?.ticket;
      });

      const busFlightsIds = passengerTickets
        ?.map((el) => [el?.busFlightFrom?.id, el?.busFlightTo?.id])
        .flat()
        .filter(Boolean);

      await Passenger.destroy(queryOpts);
      const t = await sequelize.transaction();

      try {
        await Promise.all(
          passengerTickets?.map(async (el) => {
            await updateTicketPDFFile(el, t);
            return el.id;
          })
        );
        await t.commit();
      } catch (err) {
        await t.rollback();
      }

      await BusFlight.increment(
        {
          freeSeats: 1
        },
        {
          where: {
            id: {
              [Op.in]: busFlightsIds
            }
          }
        }
      );

      return res.json({
        status: 'ok',
        data: { passengerId: passenger?.id ? String(passenger.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/tickets/:id',
  [
    param('id').isInt(),
    query('ticketId').isString(),
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
      const { ticketId } = req.query;

      let passenger;
      const query = {
        attributes: [
          'id',
          'name',
          'lastName',
          'phone',
          'additionalPhone',
          'dateOfBirth',
          'email'
        ],
        where: {
          id
        },
        order: [
          ['id', 'ASC'],
          ['lastName', 'ASC']
        ]
      };
      passenger = await Passenger.findOne(query);

      if (!passenger) {
        throw AdminAPIError.NotFoundError(`Пасажира з id ${id} не знайдено`);
      }

      let ticketQuery = {
        attributes: [
          'id',
          'dateOfDeparture',
          'dateOfReturn',
          'busFlightFromId',
          'busFlightToId',
          'price',
          'currencyAbbr',
          'typeId',
          'statusId',
          'hasDiscount',
          'discountPercentage',
          'PDFFileName',
          'prevPDFFileName',
          'originId',
          'destinationId'
        ],
        where: {
          id: ticketId
        },
        include: [
          {
            model: PassengerTicket,
            attributes: [
              'id',
              'ticketId',
              'passengerId' /*"passengerDiscountId", "discountCardNumber"*/
            ]
          },
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightFrom'
          },
          {
            model: BusFlight,
            attributes: ['id', 'routeId', 'dateOfDeparture'],
            as: 'busFlightTo'
          }
        ],
        order: [
          ['dateOfDeparture', 'ASC'],
          ['id', 'ASC']
        ]
      };

      const ticket = await Ticket.findOne(ticketQuery);

      if (!ticket) {
        throw AdminAPIError.NotFoundError(
          `Квиток з id ${ticketId} не знайдено`
        );
      }

      if (
        !ticket?.passengertickets.some(
          (el) => String(el?.passangerId) === String(id)
        )
      ) {
        throw AdminAPIError.BadRequestError('Помилка', [
          `Пасажира з id ${id} немає у квитку з id ${ticketId}`
        ]);
      }

      const queryOpts = {
        where: {
          [Op.and]: [{ ticketId: ticket?.id }, { passengerId: passenger?.id }]
        },
        returning: true,
        plain: true
      };

      await PassengerTicket.destroy(queryOpts);

      await updateTicketPDFFile(ticket);
      await BusFlight.increment(
        {
          freeSeats: 1
        },
        {
          where: {
            [Op.or]: [
              { id: ticket?.busFlightFrom?.id || null },
              { id: ticket?.busFlightTo?.id || null }
            ]
          }
        }
      );

      return res.json({
        status: 'ok',
        data: { passengerId: passenger?.id ? String(passenger.id) : '' }
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
