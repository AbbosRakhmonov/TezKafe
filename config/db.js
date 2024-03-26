const mongoose = require("mongoose");

module.exports = async () => {
  try {
    return await mongoose?.connect(process.env.MONGO_URI);
  } catch (error) {
    console.error(`Error: ${error.message}`.red);
    process.exit(1);
  }
};
