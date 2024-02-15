function removeEmptyFields(obj) {
    Object.keys(obj).forEach(
        (key) => (obj[key] === null || obj[key] === undefined || obj[key] === '') && delete obj[key],
    );
}

function removeEmptyKeys(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursively call the function for nested objects
            removeEmptyKeys(obj[key]);
            // If the nested object is now empty, delete the key
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        } else if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
            // Remove key if it has an undefined, null, or empty string value
            delete obj[key];
        }
    }
    return obj;
}

module.exports = {
    removeEmptyFields,
    removeEmptyKeys,
}