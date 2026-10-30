'use strict';

// source is 'body', 'query', or 'params'. Parsed values are placed on
// req.validated[source] so the original request objects are never mutated.
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    req.validated = { ...(req.validated || {}), [source]: result.data };
    return next();
  };
}

module.exports = validate;
