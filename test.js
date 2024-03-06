const bcrypt = require('bcryptjs');

(async () => {
    const salt = await bcrypt.genSalt(10);
    let password = await bcrypt.hash('1111', salt);
    console.log(password)
})();