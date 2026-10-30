const { Op } = require('sequelize');

function makeQuery(attr, value, operator) {
  return {
    [attr]: {
      [operator]: value
    }
  };
}

const queryHelper = {
  equals(attr, value, isOp = false) {
    if (isOp) {
      return Op.eq;
    }
    return makeQuery(attr, value, Op.eq);
  },
  contains(attr, value, isOp = false) {
    if (isOp) {
      return Op.substring;
    }
    return makeQuery(attr, value, Op.substring);
  },
  startsWith(attr, value, isOp = false) {
    if (isOp) {
      return Op.startsWith;
    }
    return makeQuery(attr, value, Op.startsWith);
  },
  endsWith(attr, value, isOp = false) {
    if (isOp) {
      return Op.endsWith;
    }
    return makeQuery(attr, value, Op.endsWith);
  },
  between(attr, value, isOp = false) {
    if (isOp) {
      return Op.between;
    }
    return makeQuery(attr, value, Op.between);
  },
  greaterThan(attr, value, isOp = false) {
    if (isOp) {
      return Op.gt;
    }
    return makeQuery(attr, value, Op.gt);
  },
  lessThan(attr, value, isOp = false) {
    if (isOp) {
      return Op.lt;
    }
    return makeQuery(attr, value, Op.lt);
  },
  greaterThanOrEqualTo(attr, value, isOp = false) {
    if (isOp) {
      return Op.gte;
    }
    return makeQuery(attr, value, Op.gte);
  },
  lessThanOrEqualTo(attr, value, isOp = false) {
    if (isOp) {
      return Op.lte;
    }
    return makeQuery(attr, value, Op.lte);
  }
};

module.exports = queryHelper;
