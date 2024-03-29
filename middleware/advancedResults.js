const {removeEmptyFields, removeEmptyKeys} = require("./globalFunctions");

function flattenAndConvertValues(obj) {
    let result = {};

    function processObject(subObj, prefix = "") {
        for (let key in subObj) {
            let newKey = prefix ? `${prefix}.${key}` : key;
            if (
                typeof subObj[key] === "object" &&
                subObj[key] !== null &&
                !Array.isArray(subObj[key])
            ) {
                processObject(subObj[key], newKey); // Recursively process nested objects
            } else {
                // Convert boolean and number-like strings
                if (subObj[key] === "true" || subObj[key] === "false") {
                    result[newKey] = subObj[key] === "true";
                } else if (!isNaN(subObj[key])) {
                    result[newKey] = Number(subObj[key]);
                } else {
                    result[newKey] = subObj[key];
                }
            }
        }
    }

    processObject(obj);
    return result;
}

const advancedResults = (model, populate) => async (req, res, next) => {
    let query;

    // Copy req.query
    const reqQuery = {...req.query};

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit", "q", "searchFields"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // remove fields which empty
    removeEmptyFields(reqQuery);
    removeEmptyKeys(reqQuery);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    queryStr = JSON.parse(queryStr);
    queryStr = flattenAndConvertValues(queryStr);

    // Handle searching if 'q' parameter is present
    if (req.query.q && req.query.searchFields) {
        const searchFields = req.query.searchFields.split(" "); // Specify the field to search if needed
        const searchValue = req.query.q.trim();
        // Add the search condition to the query
        queryStr.$or = searchFields.map((field) => ({
            [field]: {
                $regex: searchValue,
                $options: "i",
            },
        }));
    }

    query = model.find(queryStr);

    // Select Fields
    if (req.query.select) {
        query = query.select(req.query.select);
    }

    // Sort
    if (req.query.sort) {
        const sortBy = req.query.sort.split(",").join(" ");
        query = query.sort(sortBy);
    } else {
        query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const total = await model.countDocuments();

    query = query.skip(startIndex).limit(limit);

    if (populate) {
        query = query.populate(populate);
    }

    // Executing query
    const results = await query;

    res.advancedResults = {
        total: results.length < limit ? results.length : total,
        data: results,
    };

    next();
};

module.exports = advancedResults;
