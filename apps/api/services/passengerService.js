/** @format */

const validate = require('validate.js');
const sequelize = require('@database/models/index').sequelize;
const { Op } = require('sequelize');
const {
  discount: Discount,
  discountattributes: DiscountAttributes,
  language: Language,
  passenger: Passenger,
  ticket: Ticket,
  route: Route,
  busflight: BusFlight,
  routeattributes: RouteAttributes,
  passengerticket: PassengerTicket
} = require('@database/models/index');
const {
  isEmptyObject,
  subtractYears,
  getConstantTranslation
} = require('@helpers');
const constants = require('@helpers/constants.js');
const AdminAPIError = require('@exeptions/admin/api-error');
const {
  mapDiscounts,
  filterByDateDiscounts
} = require('@services/discountService');
const { updateTicketPDFFile } = require('@services/ticketService');
const { getMetaNameById } = require('@services/ticketMetaService');

async function transformPassengersData(data, price, languageId) {
  const passengersData = Object.entries(data || []);

  let discounts = await Discount.findAll({
    attributes: ['id', 'coef', 'inactivePeriod', 'group'],
    where: {
      group: {
        [Op.not]: constants.BUS_FLIGHT
      }
    },
    order: [['id', 'ASC']],
    include: [
      {
        model: DiscountAttributes,
        as: 'discountattrs',
        attributes: ['name', 'languageId'],
        where: {
          languageId: {
            [Op.in]: [1, languageId]
          }
        },
        include: [
          {
            model: Language,
            attributes: ['name', 'code'],
            where: {
              id: {
                [Op.in]: [1, languageId]
              }
            }
          }
        ]
      }
    ]
  });

  discounts = discounts?.map((discount) => discount?.toJSON());
  discounts = mapDiscounts(discounts);
  discounts = filterByDateDiscounts(discounts);

  const discountRegex = new RegExp('^discount-[0-9]+');
  const transformedData = passengersData
    .map(passengerMapper)
    .reduce(passengerReducer, {});

  function passengerMapper(el) {
    let discountId;
    let currPassengerCount = el[0].replace(/\D+/, '');

    for (let key in el[1]) {
      if (discountRegex.test(key)) {
        discountId = el[1][key];
      }
    }

    const currDiscount = discounts
      ?.filter((item) =>
        item?.[1]?.find((el) => String(el?.id) === String(discountId))
      )?.[0]?.[1]
      ?.find((el) => String(el?.id) === String(discountId));
    const discountCoef = currDiscount?.coef;
    const discountName = currDiscount?.discountattrs?.find(
      (el) => el?.language?.code === 'uk_UA'
    )?.name;
    const calcPrice = Math.round(
      parseInt(price) * (1 - Number(discountCoef || 0))
    );

    const newObj = {
      ...el[1],
      [`full-ticket-price-${currPassengerCount}`]: parseInt(price),
      [`discount-ticket-price-${currPassengerCount}`]: calcPrice,
      [`discount-percentage-${currPassengerCount}`]: (discountCoef || 0) * 100,
      [`discount-name-${currPassengerCount}`]: discountName
    };

    // console.log("newObj: ", newObj);

    return [
      el[0],
      {
        ...newObj
      }
    ];
  }

  function passengerReducer(acc, curr) {
    if (!acc[curr[0]]) {
      acc[curr[0]] = curr[1];
    }

    return acc;
  }

  return transformedData;
}

async function validatePassengersData(data, translations, startDate) {
  const dataToValidate = Object.values(data).reduce(
    (acc, curr) => (acc = { ...acc, ...curr }),
    {}
  );
  const constraints = await createValidateConstraints(
    data,
    dataToValidate,
    translations,
    startDate
  );
  const errors = validate(dataToValidate, constraints) || {};

  if (!isEmptyObject(errors)) {
    return { status: 'error', data: errors };
  }

  return { status: 'ok', data: data };
}

async function createValidateConstraints(
  data,
  dataToValidate,
  translations,
  startDate
) {
  const additionalPhoneRegex = new RegExp('^phone-additional-[0-9]+');
  const phoneRegex = new RegExp('^phone-[0-9]+');
  const nameRegex = new RegExp('^name-[0-9]+');
  const lastNameRegex = new RegExp('^last-name-[0-9]+');
  const emailRegex = new RegExp('^email-[0-9]+');
  const discountRegex = new RegExp('^discount-[0-9]+');
  const dateOfBirthRegex = new RegExp('^date-of-birth-[0-9]+');
  const cardDiscountRegex = new RegExp('^card-discount-[0-9]+');
  const constraints = {};

  let discounts = await Discount.findAll({
    attributes: ['id', 'coef', 'group', 'maxAge', 'minAge'],
    where: {
      group: {
        [Op.not]: constants.BUS_FLIGHT
      }
    },
    order: [['id', 'ASC']]
  });

  discounts = discounts?.map((discount) => discount?.toJSON());
  discounts = mapDiscounts(discounts);

  for (let passengerType in data) {
    //Get passenger type: adult or child

    const type = passengerType.match(/.+?(?=-)/)[0];
    const defaultDiscountId = '0';
    const bothDiscountIds = discounts
      .filter((el) => el[0] === constants.BOTH)[0]?.[1]
      .map((el) => String(el?.id));
    const discountCardsIds = discounts
      .filter((el) => el[0] === constants.DISCOUNT_CARD)[0]?.[1]
      .map((el) => String(el?.id));
    const discountIds =
      type === constants.ADULT
        ? discounts
            .filter((el) => el[0] === constants.ADULTS)[0]?.[1]
            .map((el) => String(el?.id))
            .concat(defaultDiscountId, discountCardsIds, bothDiscountIds)
        : discounts
            .filter((el) => el[0] === constants.CHILDREN)[0]?.[1]
            .map((el) => String(el?.id))
            .concat(defaultDiscountId, bothDiscountIds);

    for (let key in data[passengerType]) {
      const index = key.replace(/\D+/g, '');
      const currDiscount = discounts
        .filter((elem) =>
          elem[1].find(
            (el) =>
              parseInt(el?.id) === parseInt(dataToValidate['discount-' + index])
          )
        )?.[0]?.[1]
        .find(
          (el) =>
            parseInt(el?.id) === parseInt(dataToValidate['discount-' + index])
        );

      if (additionalPhoneRegex.test(key) && dataToValidate[key] !== '') {
        constraints[key] = {
          format: {
            pattern: /^\+380([5-9][0-9]\d{7})$|^\+49(\d{10,11})$/,
            message: `^${translations?.validationErrors?.['1']}`
          },
          numericality: {
            onlyInteger: true,
            notInteger: `^${translations?.validationErrors?.['2']}`
          }
        };
      }

      if (phoneRegex.test(key)) {
        constraints[key] = {
          presence: {
            allowEmpty: false,
            message: `^${translations?.validationErrors?.['3']}`
          },
          format: {
            pattern: /^\+380([5-9][0-9]\d{7})$|^\+49(\d{10,11})$/,
            message: `^${translations?.validationErrors?.['1']}`
          },
          numericality: {
            onlyInteger: true,
            notInteger: `^${translations?.validationErrors?.['2']}`
          },
          exclusion: {
            within: Object.entries(dataToValidate)
              .filter(
                ([k, _]) =>
                  phoneRegex.test(k) &&
                  Number(k.replace(/^\D+/gm, '')) <
                    Number(key.replace(/^\D+/gm, ''))
              )
              .map((el) => el?.[1]),
            message: `^${translations?.validationErrors?.['4']}`
          }
        };
      }

      if (nameRegex.test(key)) {
        constraints[key] = {
          presence: {
            allowEmpty: false,
            message: `^${translations?.validationErrors?.['3']}`
          },
          format: {
            pattern: /^[a-zA-Z\s'-]+$/,
            message: `^${translations?.validationErrors?.['12']}`
          },
          length: {
            minimum: 3,
            tooShort: `^${translations?.validationErrors?.['6']}`
          }
        };
      }

      if (lastNameRegex.test(key)) {
        constraints[key] = {
          presence: {
            allowEmpty: false,
            message: `^${translations?.validationErrors?.['3']}`
          },
          format: {
            pattern: /^[a-zA-Z\s'-]+$/,
            message: `^${translations?.validationErrors?.['12']}`
          },
          length: {
            minimum: 2,
            tooShort: `^${translations?.validationErrors?.['6']}`
          }
        };
      }

      if (emailRegex.test(key)) {
        constraints[key] = {
          presence: {
            allowEmpty: false,
            message: `^${translations?.validationErrors?.['3']}`
          },
          email: {
            message: `^${translations?.validationErrors?.['7']}`
          }
        };
      }

      if (discountRegex.test(key)) {
        constraints[key] = {
          numericality: {
            onlyInteger: true,
            notInteger: `^${translations?.validationErrors?.['8']}`
          },
          inclusion: {
            within: discountIds,
            message: `^${translations?.validationErrors?.['8']}`
          }
        };
      }

      if (cardDiscountRegex.test(key)) {
        constraints[key] = {
          presence: {
            allowEmpty: false,
            message: `^${translations?.validationErrors?.['3']}`
          },
          numericality: {
            onlyInteger: true,
            message: `^${translations?.validationErrors?.['10']}`
          }
        };
      }

      if (dateOfBirthRegex.test(key)) {
        constraints[key] = {
          presence: {
            allowEmpty: false,
            message: `^${translations?.validationErrors?.['3']}`
          },
          datetime: {
            dateOnly: true,
            notValid: `^${translations?.validationErrors?.['9']}`
          }
        };

        if (currDiscount?.maxAge) {
          constraints[key].datetime.earliest = subtractYears(
            new Date(startDate),
            parseInt(currDiscount.maxAge)
          );
          constraints[key].datetime.tooEarly =
            `^${translations?.validationErrors?.['11']}`;
        }

        if (currDiscount?.minAge) {
          constraints[key].datetime.latest = subtractYears(
            new Date(startDate),
            parseInt(currDiscount.minAge)
          );
          constraints[key].datetime.tooLate =
            `^${translations?.validationErrors?.['11']}`;
        }
      }
    }
  }

  return constraints;
}

async function transformPassengerBase(el) {
  const result = {
    passengerId: String(el?.id),
    passengerType: constants.ADULT,
    name: el?.name,
    lastName: el?.lastName,
    dateOfBirth: el?.dateOfBirth,
    phone: el?.phone,
    additionalPhone: el?.additionalPhone || '-',
    email: el?.email
  };

  return result;
}

async function transformPassenger(el) {
  const result = {
    ...(await transformPassengerBase(el)),
    tickets: el?.passengertickets
      ? await Promise.all(
          el?.passengertickets?.map(async (passengerTicket) => {
            const ticket = passengerTicket?.ticket;
            const discount = passengerTicket?.discount;

            // Get localized type and status names from the new meta system
            const ticketType =
              (await getMetaNameById(ticket?.typeId, 'uk_UA')) ||
              getConstantTranslation(ticket?.type);
            const ticketStatus =
              (await getMetaNameById(ticket?.statusId, 'uk_UA')) ||
              getConstantTranslation(ticket?.status);

            return {
              ticketId: ticket?.id ? String(ticket?.id) : '',
              type: ticketType,
              dateOfCreature: ticket?.dateOfCreature,
              dateOfDeparture: ticket?.dateOfDeparture,
              dateOfReturn: ticket?.dateOfReturn || '-',
              origin: {
                id: ticket?.originCity?.id
                  ? String(ticket?.originCity?.id)
                  : '',
                name: ticket?.originCity?.cityattrs?.[0]?.name,
                countryId: ticket?.originCity?.country?.id
                  ? String(ticket?.originCity?.country?.id)
                  : ''
              },
              destination: {
                id: ticket?.destinationCity?.id
                  ? String(ticket?.destinationCity?.id)
                  : '',
                name: ticket?.destinationCity?.cityattrs?.[0]?.name,
                countryId: ticket?.destinationCity?.country?.id
                  ? String(ticket?.destinationCity?.country?.id)
                  : ''
              },
              busFlightFrom: {
                id: ticket?.busFlightFrom?.id
                  ? String(ticket?.busFlightFrom?.id)
                  : '',
                routeId: ticket?.busFlightFrom?.routeId
                  ? String(ticket?.busFlightFrom?.routeId)
                  : '',
                freeSeats: Number(ticket?.busFlightFrom?.freeSeats),
                name: ticket?.busFlightFrom?.route?.routeattrs?.[0]?.name,
                discount: ticket?.busFlightFrom?.discount
                  ? Math.round(ticket.busFlightFrom.discount.coef * 100)
                  : 0,
                dateOfDeparture: ticket?.busFlightFrom?.dateOfDeparture
              },
              busFlightTo: ticket?.busFlightTo?.id
                ? {
                    id: ticket?.busFlightTo?.id
                      ? String(ticket?.busFlightTo?.id)
                      : '',
                    routeId: ticket?.busFlightTo?.routeId
                      ? String(ticket?.busFlightTo?.routeId)
                      : '',
                    freeSeats: Number(ticket?.busFlightTo?.freeSeats),
                    name: ticket?.busFlightTo?.route?.routeattrs?.[0]?.name,
                    discount: ticket?.busFlightTo?.discount
                      ? Math.round(ticket.busFlightTo.discount.coef * 100)
                      : 0,
                    dateOfDeparture: ticket?.busFlightTo?.dateOfDeparture
                  }
                : '-',
              price: ticket?.price,
              currency: ticket?.currencyAbbr,
              status: ticketStatus,
              dateOfFirstUsage: ticket?.dateOfFirstUsage,
              discount: ticket?.hasDiscount
                ? ticket?.discountPercentage
                : 'Без знижки',
              pdfName: ticket?.PDFFileName
                ? ticket?.PDFFileName + '.pdf'
                : null,
              isPDFExists: !!ticket?.PDFFileName,
              passengerDiscount: {
                id: discount?.id ? String(discount?.id) : '0',
                percentage: discount?.coef ? (discount?.coef || 0) * 100 : 0,
                name: discount?.discountattrs?.[0]?.name || 'Без знижки'
              },
              discountCardNumber: passengerTicket?.discountCardNumber || '-'
            };
          })
        )
      : []
  };

  return result;
}

async function createPassenger(data, ticketsData = null) {
  const t = await sequelize.transaction();
  try {
    const candidate = await Passenger.findOne({
      where: {
        phone: data?.phone || ''
      }
    });

    if (candidate) {
      throw new AdminAPIError.BadRequestError('Помилка', [
        `Пасажир з id ${candidate?.id} уже існує`
      ]);
    }

    const passenger = await Passenger.create(
      {
        name: data?.name,
        lastName: data?.lastName,
        phone: data?.phone,
        additionalPhone: data?.additionalPhone || null,
        dateOfBirth: data?.dateOfBirth,
        email: data?.email || null
      },
      { transaction: t }
    );

    if (ticketsData.length) {
      const tickets = await Ticket.findAll({
        where: {
          id: {
            [Op.in]: ticketsData?.map((el) => Number(el?.ticketId)) || []
          }
        },
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
      });

      await PassengerTicket.bulkCreate(
        tickets?.map((el) => {
          const passengerTicketData = ticketsData?.find((elem) =>
            elem?.ticketId ? String(elem?.ticketId) === String(el?.id) : false
          );
          const result = {
            ticketId: el?.id,
            passengerId: passenger?.id
          };

          if (parseInt(passengerTicketData?.passengerDiscount?.id)) {
            result['passengerDiscountId'] =
              passengerTicketData.passengerDiscount.id;
          }

          if (passengerTicketData?.discountCardNumber) {
            result['discountCardNumber'] =
              passengerTicketData.discountCardNumber;
          }

          return result;
        }),
        { transaction: t }
      );

      await Promise.all(
        tickets?.map(async (el) => {
          await updateTicketPDFFile(el, t);
          return el?.id;
        })
      );

      await BusFlight.decrement(
        { freeSeats: 1 },
        {
          where: {
            id: {
              [Op.in]: tickets
                ?.map((el) => [el?.busFlightFrom?.id, el?.busFlightTo?.id])
                .flat()
                .filter(Boolean)
            }
          }
        },
        { transaction: t }
      );
    }
    await t.commit();
    return passenger;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

function transformPassengersTableKey(key) {
  const keysMap = {
    passengerId: 'id'
    // 'dateOfCreature': 'createdAt',
    // 'currency': 'currencyAbbr',
    // 'discount': 'discountPercentage'
  };

  if (keysMap.hasOwnProperty(key)) return keysMap[key];
  return key;
}

module.exports = {
  validatePassengersData,
  transformPassengersData,
  transformPassenger,
  transformPassengersTableKey,
  transformPassengerBase,
  createPassenger
};
