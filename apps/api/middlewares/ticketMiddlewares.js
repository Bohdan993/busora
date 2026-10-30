// const APIError = require("../exeptions/api-error");

// function checkIfTicketNotCreated(req, res, next) {
//     try {

//         if(req.originalUrl.split("?")?.[0] === "/api/tickets") {
//             console.log("IS TICKET CREATED", req.session?.ticketCreated);
//         }

//         if(!(req.session?.ticketCreated)) {
//             return next();
//         }

//         throw APIError.BadRequestError("ticket already created");
//     } catch(err) {
//         return next(err);
//     }

// }

// module.exports = {
//     checkIfTicketNotCreated
// }
